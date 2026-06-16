from flask import Flask, jsonify, render_template, request
import requests
import xml.etree.ElementTree as ET
import re
import html
from datetime import datetime

app = Flask(__name__)

# Simple in-memory cache
feed_cache = {
    'data': None,
    'last_fetched': None
}

# Simulated tweets storage
simulated_tweets = []

def parse_feed_content(content_html, start_id):
    """
    Splits the HTML content of a feed entry by its <h3> headers to extract
    individual, selectable updates (e.g., Feature, Changed, Deprecated, Fixed, etc.).
    """
    if not content_html:
        return [], start_id

    # Split by h3 tags while keeping them in the output
    parts = re.split(r'(<h3>.*?</h3>)', content_html, flags=re.DOTALL)
    
    # Remove leading empty space if any
    if parts and not parts[0].strip():
        parts.pop(0)
        
    sub_updates = []
    current_type = "Update"
    i = 0
    update_id = start_id

    while i < len(parts):
        part = parts[i].strip()
        if not part:
            i += 1
            continue
            
        if part.startswith('<h3>') and part.endswith('</h3>'):
            current_type = part.replace('<h3>', '').replace('</h3>', '').strip()
            i += 1
            if i < len(parts):
                body = parts[i].strip()
                # Clean HTML tags to get pure text for drafting tweets
                clean_text = re.sub(r'<[^>]+>', '', body)
                clean_text = html.unescape(clean_text)
                clean_text = ' '.join(clean_text.split())
                
                update_id += 1
                sub_updates.append({
                    'id': f"up_{update_id}",
                    'type': current_type,
                    'html': body,
                    'text': clean_text
                })
                i += 1
        else:
            clean_text = re.sub(r'<[^>]+>', '', part)
            clean_text = html.unescape(clean_text)
            clean_text = ' '.join(clean_text.split())
            
            update_id += 1
            sub_updates.append({
                'id': f"up_{update_id}",
                'type': 'General',
                'html': part,
                'text': clean_text
            })
            i += 1
            
    return sub_updates, update_id

def fetch_and_parse():
    url = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
    r = requests.get(url, headers=headers, timeout=15)
    if r.status_code != 200:
        raise Exception(f"Failed to fetch Google Cloud feed: HTTP {r.status_code}")
        
    root = ET.fromstring(r.content)
    ns = {'atom': 'http://www.w3.org/2005/Atom'}
    
    parsed_entries = []
    update_id_counter = 0
    
    for entry in root.findall('atom:entry', ns):
        title = entry.find('atom:title', ns).text.strip()
        updated_str = entry.find('atom:updated', ns).text.strip()
        
        # Link
        link_elem = entry.find('atom:link[@rel="alternate"]', ns)
        link_href = link_elem.attrib['href'] if link_elem is not None else "https://cloud.google.com/bigquery/docs/release-notes"
        
        content_elem = entry.find('atom:content', ns)
        content_html = content_elem.text if content_elem is not None else ""
        
        sub_updates, update_id_counter = parse_feed_content(content_html, update_id_counter)
        
        parsed_entries.append({
            'date': title,
            'updated': updated_str,
            'link': link_href,
            'updates': sub_updates
        })
        
    return parsed_entries

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/releases')
def get_releases():
    force_refresh = request.args.get('refresh', 'false').lower() == 'true'
    now = datetime.now()
    
    # If cache is valid (within 5 minutes) and not forced, return cached data
    if not force_refresh and feed_cache['data'] is not None and feed_cache['last_fetched'] is not None:
        delta = (now - feed_cache['last_fetched']).total_seconds()
        if delta < 300: # 5 minutes
            return jsonify({
                'source': 'cache',
                'last_fetched': feed_cache['last_fetched'].strftime('%Y-%m-%d %H:%M:%S'),
                'entries': feed_cache['data']
            })
            
    try:
        entries = fetch_and_parse()
        feed_cache['data'] = entries
        feed_cache['last_fetched'] = now
        return jsonify({
            'source': 'network',
            'last_fetched': now.strftime('%Y-%m-%d %H:%M:%S'),
            'entries': entries
        })
    except Exception as e:
        # If network fails but we have cached data, fall back to cache
        if feed_cache['data'] is not None:
            return jsonify({
                'source': 'cache_fallback',
                'error': str(e),
                'last_fetched': feed_cache['last_fetched'].strftime('%Y-%m-%d %H:%M:%S'),
                'entries': feed_cache['data']
            })
        return jsonify({'error': str(e)}), 500

@app.route('/api/tweet', methods=['POST'])
def post_tweet():
    data = request.json or {}
    text = data.get('text', '').strip()
    if not text:
        return jsonify({'error': 'Tweet content is empty'}), 400
        
    # Simulate a small delay for posting
    import time
    time.sleep(0.8)
    
    tweet = {
        'id': len(simulated_tweets) + 1,
        'text': text,
        'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    }
    simulated_tweets.insert(0, tweet) # Add to start
    
    return jsonify({
        'success': True,
        'tweet': tweet
    })

@app.route('/api/tweets')
def get_tweets():
    return jsonify(simulated_tweets)

if __name__ == '__main__':
    app.run(debug=True, port=5000)
