const remote = require('electron').remote;
const ipc = require('electron').ipcRenderer

// Used to sve the previous values, just in case we want to revert.
var backupSettings = {};

// IPC Handlers

// This populates the configuration values from the settings object into the backup copy then triggers a reversion.
ipc.on('loadform', function (event, arg) {
    // Bundle up the form values as the settings object and send it back.
    // Currently we are only concerned with the two key values.
    if( arg.hasOwnProperty('pubkey') ) {
      backupSettings.pubkey = arg.pubkey;
    }
    if( arg.hasOwnProperty('apikey') ) {
      backupSettings.apikey = arg.apikey;
    }
    revertForm();
});

// Helpers

function revertForm() {
  // Test for values in the backup object and place them in the form accordingly.
  if( backupSettings.hasOwnProperty('pubkey') ) {
    document.getElementById('pubkey').value = backupSettings.pubkey;
  }
  if( backupSettings.hasOwnProperty('apikey') ) {
    document.getElementById('apikey').value = backupSettings.apikey;
  }
}

// Local Button Values. These are currently locally reponded to.

// Save the changes from the form to the config file.
function configChange() {
  // Create a return object and send it to the main process
  let returnValue = {};
  returnValue.pubkey = document.getElementById('pubkey').value;
  returnValue.apikey = document.getElementById('apikey').value;
  ipc.send( 'updateConfig', returnValue );
}

// This will be converted when the form is normalized.
function configClose() {
  ipc.send( 'closeConfig', returnValue );
}
