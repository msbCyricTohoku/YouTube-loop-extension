(() => { //Use an IIFE to avoid polluting the global scope
    let videoElement = null;
    let loopInterval = null;
    let loopStartTime = 0;
    let loopEndTime = 0;
    let isLoopingActive = false;
  
    //Function to find the main video element
    function findVideoElement() {
        //YouTube often uses a specific hierarchy. This might need adjustment
        //if YouTube changes its structure. Searching for the main 'video' tag
        //is usually sufficient for the watch page.
        videoElement = document.querySelector('video');
        //Add more specific selectors if needed, e.g.:
        //videoElement = document.querySelector('#movie_player video');
        return videoElement;
    }
  
    //Function to start checking the loop condition
    function startLoopCheck() {
      if (loopInterval) {
        clearInterval(loopInterval); //Clear existing interval if any
      }
  
      if (!findVideoElement()) {
          console.warn("YouTube Loop: Video element not found.");
          isLoopingActive = false; //Stop if video disappears
          return;
      }
  
      //Check every 100ms (adjust for performance vs accuracy)
      loopInterval = setInterval(() => {
        if (!videoElement || !isLoopingActive) {
          stopLoopCheck(); //Stop if video gone or loop deactivated
          return;
        }
  
        //Handle cases where video source changes (e.g., ads finish)
        //Re-check if the current video source is valid or if the element changed
        if (!videoElement.currentSrc || videoElement.paused) {
            //Don't loop if paused or no source (like during an ad transition)
            return;
        }
  
        if (videoElement.currentTime >= loopEndTime) {
          //console.log(`Looping: ${videoElement.currentTime} >= ${loopEndTime}. Seeking to ${loopStartTime}`);
          videoElement.currentTime = loopStartTime;
          //Ensure it plays if seeking caused a pause (sometimes happens)
          if (videoElement.paused) {
              videoElement.play();
          }
        }
      }, 100); //Check every 100 milliseconds
    }
  
    //Function to stop checking the loop condition
    function stopLoopCheck() {
      if (loopInterval) {
        clearInterval(loopInterval);
        loopInterval = null;
      }
      isLoopingActive = false;
      //console.log("Loop stopped.");
    }
  
    //Listen for messages from the popup
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (!findVideoElement() && request.action !== 'getState') {
           //Don't try actions if video isn't found, but allow getState
           console.warn("YouTube Loop: Video element not found for action:", request.action);
           sendResponse({ success: false, error: "Video element not found." });
           return true; //Indicates asynchronous response (optional here)
      }
  
      switch (request.action) {
        case "getCurrentTime":
          if (videoElement) {
            sendResponse({ time: videoElement.currentTime });
          } else {
              sendResponse({ time: null }); //Send null if no video
          }
          break;
  
        case "toggleLoop":
          if (isLoopingActive) {
            //Stop the loop
            stopLoopCheck();
            sendResponse({ success: true, looping: false });
          } else {
            //Start the loop
            if (request.start !== undefined && request.end !== undefined && request.end > request.start) {
              loopStartTime = request.start;
              loopEndTime = request.end;
              isLoopingActive = true;
              startLoopCheck(); //Start the interval checker
              //Immediately jump to start if current time is outside loop range
               if (videoElement && (videoElement.currentTime < loopStartTime || videoElement.currentTime > loopEndTime)) {
                   videoElement.currentTime = loopStartTime;
               }
              sendResponse({ success: true, looping: true });
            } else {
              sendResponse({ success: false, error: "Invalid start/end times provided." });
            }
          }
          break;
  
        case "getState":
          //Send the current state back to the popup
          sendResponse({
            looping: isLoopingActive,
            start: loopStartTime,
            end: loopEndTime
          });
          break;
  
        default:
          console.log("Unknown action:", request.action);
          sendResponse({ success: false, error: "Unknown action" });
          break;
      }
  
      //`return true;` is important for asynchronous `sendResponse` calls,
      //though in this synchronous handling, it might not be strictly necessary
      //but is good practice.
      return true;
    });
  
    //Initial check for video element when script loads
    findVideoElement();
  
    //Optional: Use MutationObserver to detect if the video element is added later
    //or replaced (e.g., during SPA navigation on YouTube)
    const observer = new MutationObserver((mutations) => {
        if (!videoElement || !document.body.contains(videoElement)) {
            //console.log("Video element possibly changed/removed, attempting to find again.");
            if (findVideoElement()) {

                if (isLoopingActive) {
                }
            } else if (isLoopingActive) {
                //console.log("Video element lost, stopping loop.");
                stopLoopCheck(); //Stop if the video element is gone
            }
        }
    });
  
    observer.observe(document.body, { childList: true, subtree: true });
  
  
    console.log("YouTube Loop content script loaded.");
  
  })(); //End IIFE