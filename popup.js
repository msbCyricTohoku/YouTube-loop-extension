document.addEventListener('DOMContentLoaded', () => {
    const startTimeInput = document.getElementById('startTime');
    const endTimeInput = document.getElementById('endTime');
    const setStartButton = document.getElementById('setStart');
    const setEndButton = document.getElementById('setEnd');
    const toggleLoopButton = document.getElementById('toggleLoop');
    const resetButton = document.getElementById('resetTimes');
    const statusElement = document.getElementById('status');
  
    let currentTabId = null;
    let isLooping = false;

    function setStatus(text, type = 'idle') {
        statusElement.textContent = text;
        statusElement.className = type;
    }
  
    //get active tab to send messages
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length > 0 && tabs[0].url && tabs[0].url.includes("youtube.com/watch")) {
        currentTabId = tabs[0].id;
        //request initial state from content script when popup opens
        chrome.tabs.sendMessage(currentTabId, { action: "getState" }, (response) => {
          if (chrome.runtime.lastError) {
            setStatus("Error: Couldn't connect to page. Reload page?", "error");
            console.error(chrome.runtime.lastError.message);
            disableInputs();
            return;
          }
          if (response) {
            isLooping = response.looping;
            startTimeInput.value = response.start || '';
            endTimeInput.value = response.end || '';
            updateLoopButton();
            setStatus(`Status: ${isLooping ? 'Looping' : 'Idle'}`, isLooping ? 'looping' : 'idle');
          } else {
             setStatus("Status: Not on YouTube video?", "error");
             disableInputs();
          }
        });
      } else {
        setStatus("Status: Not on YouTube video", "error");
        disableInputs();
      }
    });
  
     //load saved times from storage
     chrome.storage.sync.get(['loopStartTime', 'loopEndTime'], (result) => {
        if (result.loopStartTime !== undefined) {
           startTimeInput.value = result.loopStartTime;
        }
        if (result.loopEndTime !== undefined) {
           endTimeInput.value = result.loopEndTime;
        }
     });
  
    function disableInputs() {
        startTimeInput.disabled = true;
        endTimeInput.disabled = true;
        setStartButton.disabled = true;
        setEndButton.disabled = true;
        toggleLoopButton.disabled = true;
    }
  
    function updateLoopButton() {
      if (isLooping) {
        toggleLoopButton.textContent = "Stop Loop";
        toggleLoopButton.classList.add('looping');
      } else {
        toggleLoopButton.textContent = "Start Loop";
        toggleLoopButton.classList.remove('looping');
      }
    }
  
    setStartButton.addEventListener('click', () => {
      if (!currentTabId) return;
      chrome.tabs.sendMessage(currentTabId, { action: "getCurrentTime" }, (response) => {
         if (chrome.runtime.lastError) {
             console.error("Error getting current time:", chrome.runtime.lastError.message);
             setStatus("Error getting time.", "error");
             return;
         }
        if (response && response.time !== undefined) {
          startTimeInput.value = Math.floor(response.time); //use floor to get integer seconds
        }
      });
    });
  
    setEndButton.addEventListener('click', () => {
      if (!currentTabId) return;
      chrome.tabs.sendMessage(currentTabId, { action: "getCurrentTime" }, (response) => {
         if (chrome.runtime.lastError) {
             console.error("Error getting current time:", chrome.runtime.lastError.message);
             setStatus("Error getting time.", "error");
             return;
         }
        if (response && response.time !== undefined) {
          endTimeInput.value = Math.ceil(response.time); //use ceil to get integer seconds
        }
      });
    });
  
    toggleLoopButton.addEventListener('click', () => {
      if (!currentTabId) return;
  
      const start = parseFloat(startTimeInput.value);
      const end = parseFloat(endTimeInput.value);
  
      if (isNaN(start) || isNaN(end) || start < 0 || end <= start) {
        setStatus("Status: Invalid start/end times.", "error");
        return;
      }
  
      //save times to storage
      chrome.storage.sync.set({ loopStartTime: start, loopEndTime: end });
  
  
      chrome.tabs.sendMessage(currentTabId, { action: "toggleLoop", start: start, end: end }, (response) => {
          if (chrome.runtime.lastError) {
              console.error("Error toggling loop:", chrome.runtime.lastError.message);
              setStatus("Error toggling loop.", "error");
              return;
          }
        if (response && response.success) {
          isLooping = response.looping;
          updateLoopButton();
          setStatus(`Status: ${isLooping ? 'Looping' : 'Stopped'}`, isLooping ? 'looping' : 'idle');
        } else {
          setStatus("Status: Action failed.", "error");
        }
      });
    });

    resetButton.addEventListener('click', () => {
      startTimeInput.value = '';
      endTimeInput.value = '';
      chrome.storage.sync.remove(['loopStartTime', 'loopEndTime']);
      if (isLooping && currentTabId) {
        chrome.tabs.sendMessage(currentTabId, { action: "toggleLoop" }, () => {});
        isLooping = false;
        updateLoopButton();
      }
      setStatus('Status: Idle', 'idle');
    });
  });