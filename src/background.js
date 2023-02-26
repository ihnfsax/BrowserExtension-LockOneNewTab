importScripts("browser-polyfill.js");

var handling = false;
var working = false;

function isNewTab(url) {
    url = url.trim();
    return url.indexOf("/newtab/") !== -1;
}

async function handleEvent(tabId, windowId, eventType) {
    if (handling) return;

    // console.log(`handle event: ${eventType}, tab id: ${tabId}`);
    
    // return if window doesn't exist
    try {
        await browser.windows.get(windowId);
    } catch (error) {
        return;
    }

    var tabInfo
    
    if (tabId != -1) {    
        try {
            tabInfo = await browser.tabs.get(tabId);
        } catch (error) {
            tabId = -1;
        }
    }
    
    // return if url is not ready to be checked
    if (tabId != -1 && tabInfo.url.length == 0)
        return;
    
    handling = true;
    let wasWorking = false;
    let windowPinnedTabs = await browser.tabs.query({"windowId": windowId, "pinned": true});

    if (tabId != -1) {
        if (tabInfo.pinned == true && (!isNewTab(tabInfo.url) || windowPinnedTabs.length > 1) && !working) {
            working = true;
            try {
                // console.log(`unpin: ${tabId}, tab url: ${tabInfo.url}, pinned length: ${windowPinnedTabs.length}`);
                await browser.tabs.update(tabId, {"pinned": false});
                windowPinnedTabs.length--;
                wasWorking = true;
            } catch(error) {
                setTimeout(function() { handleEvent(tabId, windowId, "redo"); }, 30);
            }
            working = false;
        }
        
        if (windowPinnedTabs.length == 1) {
            let pinnedId = windowPinnedTabs[0].id;
            if (isNewTab(tabInfo.url) && tabId != pinnedId && !working) {
                working = true;
                try {
                    // console.log(`remove: ${pinnedId}, active: ${tabId}`);
                    await browser.tabs.remove(pinnedId);
                    await browser.tabs.update(tabId, {"active": true, "pinned": true});
                    wasWorking = true;
                } catch(error) {
                    setTimeout(function() { handleEvent(tabId, windowId, "redo"); }, 30);
                }
                working = false;
            }
        }
    }

    if (windowPinnedTabs.length == 0 && !working) {
        working = true;
        try {
            // console.log(`create one pinned tab`);
            await browser.tabs.create({"windowId": windowId, "index": 0, "pinned": true, "active": false});
            wasWorking = true;
        } catch(error) {
            setTimeout(function() { handleEvent(tabId, windowId, "redo"); }, 30);
        }
        working = false;
    }

    handling = false;
	if (wasWorking)
		setTimeout(function() { handleEvent(tabId, windowId,"redo"); }, 30);
}


browser.tabs.onCreated.addListener(function(tab){
    handleEvent(tab.id, tab.windowId, "browser.tabs.onCreated");
});
browser.tabs.onUpdated.addListener(function(tabId, _, tab) {
    handleEvent(tabId, tab.windowId, "browser.tabs.onUpdated");
});
browser.tabs.onAttached.addListener(function(tabId, attachInfo) {
    handleEvent(tabId, attachInfo.newWindowId, "browser.tabs.onAttached");
});
browser.tabs.onDetached.addListener(function(tabId, detachInfo) {
    handleEvent(tabId, detachInfo.oldWindowId, "browser.tabs.onDetached");
});
browser.tabs.onActivated.addListener(function(activeInfo) {
    handleEvent(activeInfo.tabId, activeInfo.windowId, "browser.tabs.onActivated");
});
browser.tabs.onRemoved.addListener(function(_, removeInfo) {
    handleEvent(-1, removeInfo.windowId, "browser.tabs.onRemoved");
});
browser.tabs.onMoved.addListener(function(tabId, moveInfo) {
    handleEvent(tabId, moveInfo.windowId, "browser.tabs.onMoved");
});