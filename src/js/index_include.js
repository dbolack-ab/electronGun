const remote = require('electron').remote;
const ipc = require('electron').ipcRenderer

function pullLists()
{
  ipc.send('loadLists');
}

function editList( listName )
{
  ipc.send('launchEdit', { listName: listName });
}
