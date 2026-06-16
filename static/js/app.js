// State Management
let appState = {
    entries: [],
    selectedUpdates: new Set(), // Set of update IDs
    currentFilter: 'all',
    searchQuery: '',
    theme: 'dark'
};

// DOM Elements
const elements = {
    timeline: document.getElementById('release-notes-timeline'),
    refreshBtn: document.getElementById('refresh-btn'),
    refreshIcon: document.getElementById('refresh-icon'),
    themeToggleBtn: document.getElementById('theme-toggle-btn'),
    searchInput: document.getElementById('search-input'),
    clearSearchBtn: document.getElementById('clear-search-btn'),
    lastFetchTime: document.getElementById('last-fetch-time'),
    categoryFilters: document.getElementById('category-filters'),
    
    // Floating Bar
    floatingBar: document.getElementById('floating-bar'),
    selectedCount: document.getElementById('selected-count'),
    clearSelectionBtn: document.getElementById('clear-selection-btn'),
    tweetSelectedBtn: document.getElementById('tweet-selected-btn'),
    
    // Modal
    tweetModal: document.getElementById('tweet-modal'),
    closeModalBtn: document.getElementById('close-modal-btn'),
    cancelTweetBtn: document.getElementById('cancel-tweet-btn'),
    tweetTextarea: document.getElementById('tweet-textarea'),
    previewList: document.getElementById('preview-list'),
    simulatePostBtn: document.getElementById('simulate-post-btn'),
    realPostBtn: document.getElementById('real-post-btn'),
    charCountText: document.getElementById('char-count-text'),
    progressCircle: document.getElementById('progress-circle'),
    limitWarningMsg: document.getElementById('limit-warning-msg'),
    
    // Simulated X Feed
    simulatedTweetsList: document.getElementById('simulated-tweets-list'),
    tweetCount: document.getElementById('tweet-count'),
    toastContainer: document.getElementById('toast-container')
};

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    setupEventListeners();
    fetchReleases(false);
    fetchSimulatedTweets();
});

// Theme Initialization
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    appState.theme = savedTheme;
    if (savedTheme === 'light') {
        document.body.classList.add('light-theme');
        document.body.classList.remove('dark-theme');
    } else {
        document.body.classList.add('dark-theme');
        document.body.classList.remove('light-theme');
    }
}

// Setup Event Listeners
function setupEventListeners() {
    // Refresh button
    elements.refreshBtn.addEventListener('click', () => fetchReleases(true));
    
    // Theme toggle
    elements.themeToggleBtn.addEventListener('click', toggleTheme);
    
    // Search input
    elements.searchInput.addEventListener('input', (e) => {
        appState.searchQuery = e.target.value.toLowerCase().trim();
        elements.clearSearchBtn.style.display = appState.searchQuery ? 'block' : 'none';
        renderTimeline();
    });
    
    elements.clearSearchBtn.addEventListener('click', () => {
        elements.searchInput.value = '';
        appState.searchQuery = '';
        elements.clearSearchBtn.style.display = 'none';
        renderTimeline();
    });
    
    // Category pills filter
    elements.categoryFilters.addEventListener('click', (e) => {
        const pill = e.target.closest('.pill');
        if (!pill) return;
        
        // Update active class
        elements.categoryFilters.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        
        appState.currentFilter = pill.dataset.type;
        renderTimeline();
    });
    
    // Floating bar actions
    elements.clearSelectionBtn.addEventListener('click', clearSelection);
    elements.tweetSelectedBtn.addEventListener('click', openComposerForSelected);
    
    // Modal actions
    elements.closeModalBtn.addEventListener('click', closeModal);
    elements.cancelTweetBtn.addEventListener('click', closeModal);
    elements.tweetTextarea.addEventListener('input', handleTweetTyping);
    elements.simulatePostBtn.addEventListener('click', handleSimulatePost);
    elements.realPostBtn.addEventListener('click', handleRealPost);
}

// Toggle Theme
function toggleTheme() {
    if (appState.theme === 'dark') {
        appState.theme = 'light';
        document.body.classList.add('light-theme');
        document.body.classList.remove('dark-theme');
    } else {
        appState.theme = 'dark';
        document.body.classList.add('dark-theme');
        document.body.classList.remove('light-theme');
    }
    localStorage.setItem('theme', appState.theme);
    showToast('Theme updated!', 'info');
}

// Fetch Release Notes
async function fetchReleases(force = false) {
    // Set loading state
    elements.refreshIcon.classList.add('spinning');
    elements.refreshBtn.disabled = true;
    
    // Show shimmers
    showShimmerLoader();
    
    try {
        const url = `/api/releases${force ? '?refresh=true' : ''}`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        appState.entries = data.entries || [];
        elements.lastFetchTime.textContent = formatTime(data.last_fetched) || 'Just now';
        
        // Clear selection when data is refreshed
        clearSelection();
        
        // Render timeline
        renderTimeline();
        
        if (force) {
            showToast('Release notes successfully synced!', 'success');
        }
    } catch (error) {
        console.error('Fetch error:', error);
        showToast(`Sync failed: ${error.message}`, 'error');
        renderErrorState(error.message);
    } finally {
        elements.refreshIcon.classList.remove('spinning');
        elements.refreshBtn.disabled = false;
    }
}

// Render Shimmer Loader
function showShimmerLoader() {
    elements.timeline.innerHTML = `
        <div class="shimmer-wrapper">
            <div class="shimmer-card"><div class="shimmer-title"></div><div class="shimmer-body"></div></div>
            <div class="shimmer-card"><div class="shimmer-title"></div><div class="shimmer-body"></div></div>
            <div class="shimmer-card"><div class="shimmer-title"></div><div class="shimmer-body"></div></div>
        </div>
    `;
}

// Render Error State
function renderErrorState(message) {
    elements.timeline.innerHTML = `
        <div class="no-tweets-placeholder glass" style="padding: 40px; border-radius: 16px;">
            <i class="fa-solid fa-circle-exclamation" style="font-size: 48px; color: var(--issue-color); margin-bottom: 16px;"></i>
            <h3>Failed to Fetch Release Notes</h3>
            <p style="margin-top: 8px; font-size: 13px; color: var(--text-secondary); max-width: 400px; margin-left: auto; margin-right: auto;">
                ${message || 'Could not connect to the Google Cloud release feed.'}
            </p>
            <button class="btn btn-primary btn-sm" onclick="fetchReleases(true)" style="margin-top: 20px;">
                <i class="fa-solid fa-rotate-right"></i> Try Again
            </button>
        </div>
    `;
}

// Render Timeline
function renderTimeline() {
    if (appState.entries.length === 0) {
        renderErrorState('No release notes found.');
        return;
    }
    
    let htmlContent = '';
    let totalRendered = 0;
    
    appState.entries.forEach(entry => {
        // Filter sub-updates
        const filteredUpdates = entry.updates.filter(update => {
            const matchesCategory = appState.currentFilter === 'all' || 
                update.type.toLowerCase() === appState.currentFilter;
                
            const matchesSearch = !appState.searchQuery || 
                update.text.toLowerCase().includes(appState.searchQuery) ||
                update.type.toLowerCase().includes(appState.searchQuery) ||
                entry.date.toLowerCase().includes(appState.searchQuery);
                
            return matchesCategory && matchesSearch;
        });
        
        if (filteredUpdates.length === 0) return;
        
        totalRendered += filteredUpdates.length;
        
        // Start date group
        htmlContent += `
            <div class="timeline-group">
                <div class="timeline-date-node">
                    <div class="timeline-dot"></div>
                    <div class="timeline-date-label">${entry.date}</div>
                </div>
                <div class="timeline-cards">
        `;
        
        // Render each update
        filteredUpdates.forEach(update => {
            const isSelected = appState.selectedUpdates.has(update.id);
            const selectedClass = isSelected ? 'selected' : '';
            const checkedAttr = isSelected ? 'checked' : '';
            
            htmlContent += `
                <div class="note-card glass ${selectedClass}" data-update-id="${update.id}" onclick="toggleUpdateSelection(event, '${update.id}')">
                    <div class="card-header">
                        <div class="card-header-left">
                            <label class="select-checkbox-container" onclick="event.stopPropagation()">
                                <input type="checkbox" ${checkedAttr} onchange="handleCheckboxChange('${update.id}', this.checked)">
                                <span class="checkmark"></span>
                            </label>
                            <span class="type-tag ${update.type.toLowerCase()}">${update.type}</span>
                        </div>
                        <div class="card-actions">
                            <button class="btn-card-action tweet-action" title="Tweet this update" onclick="event.stopPropagation(); openComposerForSingle('${entry.date}', '${update.id}')">
                                <i class="fa-brands fa-x-twitter"></i>
                            </button>
                        </div>
                    </div>
                    <div class="card-content">
                        ${update.html}
                    </div>
                </div>
            `;
        });
        
        // End date group
        htmlContent += `
                </div>
            </div>
        `;
    });
    
    if (totalRendered === 0) {
        elements.timeline.innerHTML = `
            <div class="no-tweets-placeholder glass" style="padding: 40px; border-radius: 16px; width:100%;">
                <i class="fa-solid fa-magnifying-glass" style="font-size: 36px; opacity: 0.3; margin-bottom: 12px;"></i>
                <h3>No Matching Updates Found</h3>
                <p style="font-size: 13px; color: var(--text-secondary); margin-top: 6px;">
                    Try refining your search terms or selecting a different category.
                </p>
            </div>
        `;
    } else {
        elements.timeline.innerHTML = htmlContent;
    }
}

// Find an update object by its ID
function findUpdateById(id) {
    for (const entry of appState.entries) {
        const found = entry.updates.find(u => u.id === id);
        if (found) {
            return {
                entryDate: entry.date,
                entryLink: entry.link,
                update: found
            };
        }
    }
    return null;
}

// Selection Handlers
function toggleUpdateSelection(event, id) {
    // If the click was on a link or button inside the card, ignore
    if (event.target.tagName === 'A' || event.target.closest('.btn-card-action')) {
        return;
    }
    
    const isSelected = appState.selectedUpdates.has(id);
    handleCheckboxChange(id, !isSelected);
}

function handleCheckboxChange(id, isChecked) {
    if (isChecked) {
        appState.selectedUpdates.add(id);
    } else {
        appState.selectedUpdates.delete(id);
    }
    
    // Update card class in DOM directly for animation smoothness
    const card = document.querySelector(`.note-card[data-update-id="${id}"]`);
    if (card) {
        const checkbox = card.querySelector('input[type="checkbox"]');
        if (checkbox) checkbox.checked = isChecked;
        
        if (isChecked) {
            card.classList.add('selected');
        } else {
            card.classList.remove('selected');
        }
    }
    
    updateFloatingBar();
}

function updateFloatingBar() {
    const count = appState.selectedUpdates.size;
    elements.selectedCount.textContent = count;
    
    if (count > 0) {
        elements.floatingBar.classList.add('visible');
    } else {
        elements.floatingBar.classList.remove('visible');
    }
}

function clearSelection() {
    // Uncheck all in DOM
    appState.selectedUpdates.forEach(id => {
        const card = document.querySelector(`.note-card[data-update-id="${id}"]`);
        if (card) {
            card.classList.remove('selected');
            const checkbox = card.querySelector('input[type="checkbox"]');
            if (checkbox) checkbox.checked = false;
        }
    });
    
    appState.selectedUpdates.clear();
    updateFloatingBar();
}

// Toast Notifications
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let iconClass = 'fa-info-circle';
    if (type === 'success') iconClass = 'fa-circle-check';
    if (type === 'error') iconClass = 'fa-triangle-exclamation';
    
    toast.innerHTML = `
        <i class="fa-solid ${iconClass}"></i>
        <span>${message}</span>
    `;
    
    elements.toastContainer.appendChild(toast);
    
    // Remove toast after 4 seconds
    setTimeout(() => {
        toast.style.animation = 'toastIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) reverse forwards';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// X/Twitter Compose Logic
function openComposerForSingle(date, updateId) {
    const data = findUpdateById(updateId);
    if (!data) return;
    
    const updateText = data.update.text;
    const dateLabel = date;
    
    const draftText = `BigQuery Update (${dateLabel}):\n"${truncateText(updateText, 180)}"\n\nDetails: ${data.entryLink}\n#GoogleCloud #BigQuery`;
    
    populateComposer([data], draftText);
    openModal();
}

function openComposerForSelected() {
    if (appState.selectedUpdates.size === 0) return;
    
    const selectedData = [];
    appState.selectedUpdates.forEach(id => {
        const data = findUpdateById(id);
        if (data) selectedData.push(data);
    });
    
    // Sort selected updates by date descending (they are already fetched this way)
    // Build combined tweet draft
    let draftText = `Latest BigQuery Updates 🚀\n`;
    
    if (selectedData.length === 1) {
        const item = selectedData[0];
        draftText = `BigQuery Update (${item.entryDate}):\n"${truncateText(item.update.text, 180)}"\n\nDetails: ${item.entryLink}\n#GoogleCloud #BigQuery`;
    } else {
        selectedData.forEach((item, index) => {
            if (index < 3) { // Show up to 3 updates in the tweet bullets
                draftText += `• [${item.update.type}] ${truncateText(item.update.text, 50)}\n`;
            }
        });
        if (selectedData.length > 3) {
            draftText += `• And ${selectedData.length - 3} more updates...\n`;
        }
        draftText += `\nRead more here: ${selectedData[0].entryLink}\n#GoogleCloud #BigQuery`;
    }
    
    populateComposer(selectedData, draftText);
    openModal();
}

function populateComposer(selectedItems, draftText) {
    elements.tweetTextarea.value = draftText;
    
    // Set previews
    elements.previewList.innerHTML = selectedItems.map(item => `
        <li>
            <span class="preview-dot" style="background-color: var(--${item.update.type.toLowerCase()}-color, var(--general-color))"></span>
            <span class="text"><strong>[${item.entryDate} - ${item.update.type}]</strong> ${item.update.text}</span>
        </li>
    `).join('');
    
    // Update character limit counter
    updateCharCounter();
}

function updateCharCounter() {
    const text = elements.tweetTextarea.value;
    const len = text.length;
    
    // X (Twitter) character limit details
    const standardLimit = 280;
    const remaining = standardLimit - len;
    
    elements.charCountText.textContent = remaining;
    
    // Style adjustments
    if (remaining < 0) {
        elements.charCountText.style.color = 'var(--issue-color)';
        elements.limitWarningMsg.style.display = 'block';
    } else if (remaining <= 20) {
        elements.charCountText.style.color = 'var(--deprecated-color)';
        elements.limitWarningMsg.style.display = 'none';
    } else {
        elements.charCountText.style.color = 'var(--text-secondary)';
        elements.limitWarningMsg.style.display = 'none';
    }
    
    // Update SVG progress ring
    const radius = 12;
    const circumference = 2 * Math.PI * radius;
    const percent = Math.min((len / standardLimit) * 100, 100);
    const offset = circumference - (percent / 100) * circumference;
    
    elements.progressCircle.style.strokeDasharray = `${circumference} ${circumference}`;
    elements.progressCircle.style.strokeDashoffset = offset;
    
    // Color of the circle indicator
    if (percent >= 100) {
        elements.progressCircle.style.stroke = 'var(--issue-color)';
    } else if (percent >= 90) {
        elements.progressCircle.style.stroke = 'var(--deprecated-color)';
    } else {
        elements.progressCircle.style.stroke = '#1d9bf0';
    }
}

function handleTweetTyping() {
    updateCharCounter();
}

function openModal() {
    elements.tweetModal.classList.add('visible');
}

function closeModal() {
    elements.tweetModal.classList.remove('visible');
}

// Simulate Posting Tweet
async function handleSimulatePost() {
    const tweetText = elements.tweetTextarea.value.trim();
    if (!tweetText) {
        showToast('Cannot post an empty tweet!', 'error');
        return;
    }
    
    // Disable buttons & show loading
    elements.simulatePostBtn.disabled = true;
    elements.realPostBtn.disabled = true;
    const originalContent = elements.simulatePostBtn.innerHTML;
    elements.simulatePostBtn.innerHTML = `<i class="fa-solid fa-spinner spinning"></i> Posting...`;
    
    try {
        const response = await fetch('/api/tweet', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: tweetText })
        });
        
        const data = await response.json();
        if (data.error) {
            throw new Error(data.error);
        }
        
        // Success actions
        closeModal();
        clearSelection();
        showToast('Successfully simulated tweet post!', 'success');
        
        // Refresh mock feed
        await fetchSimulatedTweets();
    } catch (error) {
        showToast(`Failed to post: ${error.message}`, 'error');
    } finally {
        elements.simulatePostBtn.disabled = false;
        elements.realPostBtn.disabled = false;
        elements.simulatePostBtn.innerHTML = originalContent;
    }
}

// Real Twitter share intent
function handleRealPost() {
    const tweetText = elements.tweetTextarea.value.trim();
    if (!tweetText) return;
    
    const encoded = encodeURIComponent(tweetText);
    const url = `https://twitter.com/intent/tweet?text=${encoded}`;
    
    window.open(url, '_blank');
    closeModal();
    showToast('X (Twitter) intent opened in a new tab!', 'success');
}

// Fetch and Render Simulated Tweets
async function fetchSimulatedTweets() {
    try {
        const response = await fetch('/api/tweets');
        const tweets = await response.json();
        
        elements.tweetCount.textContent = `${tweets.length} posted`;
        
        if (tweets.length === 0) {
            elements.simulatedTweetsList.innerHTML = `
                <div class="no-tweets-placeholder">
                    <i class="fa-brands fa-x-twitter placeholder-icon"></i>
                    <p>No simulated tweets yet. Select updates to compose and post a simulated tweet!</p>
                </div>
            `;
            return;
        }
        
        elements.simulatedTweetsList.innerHTML = tweets.map(tweet => `
            <div class="simulated-tweet">
                <div class="tweet-header">
                    <div class="tweet-avatar">
                        <i class="fa-solid fa-robot"></i>
                    </div>
                    <div class="tweet-user-info">
                        <span class="tweet-name">BigQuery Agent <i class="fa-solid fa-circle-check verified-badge"></i></span>
                        <span class="tweet-handle">@BigQueryNotes</span>
                    </div>
                </div>
                <div class="tweet-body">
                    ${escapeHtml(tweet.text).replace(/\n/g, '<br>')}
                </div>
                <div class="tweet-footer">
                    <span>${formatTime(tweet.timestamp)}</span>
                    <div class="tweet-actions-row">
                        <i class="fa-regular fa-comment tweet-action-icon"></i>
                        <i class="fa-solid fa-retweet tweet-action-icon"></i>
                        <i class="fa-regular fa-heart tweet-action-icon"></i>
                    </div>
                </div>
            </div>
        `).join('');
    } catch (e) {
        console.error('Failed to load simulated tweets:', e);
    }
}

// Helper Utilities
function truncateText(str, maxLength) {
    if (str.length <= maxLength) return str;
    return str.slice(0, maxLength - 3) + '...';
}

function formatTime(timeStr) {
    if (!timeStr) return '';
    try {
        // Handle ISO format vs standard timestamp
        const date = new Date(timeStr.replace(/-/g, '/').replace('T', ' '));
        if (isNaN(date.getTime())) {
            // If replace causes issues, try native parsing
            const nativeDate = new Date(timeStr);
            if (isNaN(nativeDate.getTime())) return timeStr;
            return nativeDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ' + nativeDate.toLocaleDateString();
        }
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ' + date.toLocaleDateString();
    } catch (e) {
        return timeStr;
    }
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}
