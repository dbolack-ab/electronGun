const remote = require('electron').remote;
const ipc = require('electron').ipcRenderer

var backupSettings = {};

// Events the config window listens For
ipc.on('loadform', function (event, arg) {
    // Bundle up the form values as the settings object and send it back.
    console.log('Updating:' + JSON.stringify( arg ) )
    if( arg.hasOwnProperty('pubkey') ) {
      backupSettings.pubkey = arg.pubkey;
    }
    if( arg.hasOwnProperty('apikey') ) {
      backupSettings.apikey = arg.apikey;
    }
    revertForm();
});

function revertForm() {
  if( backupSettings.hasOwnProperty('pubkey') ) {
    document.getElementById('pubkey').value = backupSettings.pubkey;
  }
  if( backupSettings.hasOwnProperty('apikey') ) {
    document.getElementById('apikey').value = backupSettings.apikey;
  }
}

function configChange() {
  let returnValue = {};
  returnValue.pubkey = document.getElementById('pubkey').value;
  returnValue.apikey = document.getElementById('apikey').value;
  ipc.send( 'updateConfig', returnValue );
}

function configRevert() {
  let returnValue = {};
  revertForm();
}

function configClose() {
  let returnValue = {};
  ipc.send( 'closeConfig', returnValue );
}
