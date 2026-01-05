/**
 * Content script for tracking interactions on bsky.app
 * Intercepts like/repost actions to record them locally
 */

console.log('[Universe] Content script loaded');

// Track like button clicks to record your likes
// Since there's no API to get "posts I liked", we track them in real-time

let isInitialized = false;

function initialize() {
  if (isInitialized) return;
  isInitialized = true;

  console.log('[Universe] Initializing interaction tracking...');

  // Use MutationObserver to detect new posts/buttons being added to the DOM
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        // Look for like buttons in newly added nodes
        mutation.addedNodes.forEach((node) => {
          if (node instanceof Element) {
            attachLikeListeners(node);
          }
        });
      }
    }
  });

  // Start observing the document
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // Also attach to existing elements
  attachLikeListeners(document.body);
}

function attachLikeListeners(container: Element) {
  // Bluesky uses aria-label for buttons
  // Like buttons have aria-label containing "Like" or "Unlike"
  const likeButtons = container.querySelectorAll('[aria-label*="Like"]');

  likeButtons.forEach((button) => {
    if (button.getAttribute('data-universe-tracked')) return;
    button.setAttribute('data-universe-tracked', 'true');

    button.addEventListener('click', handleLikeClick);
  });
}

function handleLikeClick(event: Event) {
  const button = event.currentTarget as Element;
  const ariaLabel = button.getAttribute('aria-label') || '';

  // Determine if this is a like or unlike action
  const isLiking = !ariaLabel.toLowerCase().includes('unlike');

  // Try to find the post URI from the surrounding context
  const postUri = findPostUri(button);

  if (postUri) {
    console.log('[Universe] Detected like action:', { postUri, isLiking });

    // Send to background script to record
    chrome.runtime.sendMessage({
      type: isLiking ? 'RECORD_LIKE' : 'RECORD_UNLIKE',
      postUri,
      timestamp: Date.now(),
    });
  }
}

function findPostUri(element: Element): string | null {
  // Walk up the DOM to find a post container with a URI
  let current: Element | null = element;

  while (current && current !== document.body) {
    // Look for data attributes or links that contain the post URI
    const postLink = current.querySelector('a[href*="/post/"]');
    if (postLink) {
      const href = postLink.getAttribute('href');
      if (href) {
        // Convert URL path to AT URI format
        // /profile/handle.bsky.social/post/abc123 -> at://did/app.bsky.feed.post/abc123
        // For now, just return the path as a reference
        return href;
      }
    }

    // Check for data-testid or other attributes
    const testId = current.getAttribute('data-testid');
    if (testId && testId.includes('post')) {
      // Found a post container, try to extract URI
      const link = current.querySelector('a[href*="/post/"]');
      if (link) {
        return link.getAttribute('href');
      }
    }

    current = current.parentElement;
  }

  return null;
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}

export {};
