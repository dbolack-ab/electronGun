const remote = require('electron').remote;
const ipc = require('electron').ipcRenderer
const mg = require('mailgun-es6');

var mailgun;
var list;
var listObject;
var members = [];

ipc.on('loadList', function(event, arg) {
  mailgun = new mg({ privateApi: arg.config.apikey, publicApi: arg.config.pubkey, domainName: 'thesilverneedle.com'} );
  document.getElementById('userList').getElementsByTagName('tbody')[0].innerHTML = '';
  list = arg.listName;
  console.log( "Setting list to "  + list );
  if ( arg.hasOwnProperty('membersList') ) {
    console.log("List has " + arg.membersList.length + " subscribers");
    renderUserList( arg.membersList);
  }
})

function closeList() {
  ipc.send('closeListWindow', {});
}

function renderUserList( membersList ) {

  let tBody = document.getElementById('userList').getElementsByTagName('tbody')[0];

  membersList.forEach( function(entry) {
    let newTR = document.createElement('tr');
    let newTD = document.createElement('td');
    newTD.innerHTML = entry.address;
    newTR.appendChild(newTD);
    tBody.appendChild(newTR);
  });
}

function pagesSuccess ( oRes ) {
  let o = oRes.res;
  // Make sure we have a paging object
  if ( o.hasOwnProperty( 'paging' ) )
  {
    // Make sure we have a next
    if ( o.paging.hasOwnProperty ( 'next' ) ) {
      let urlArray = o.paging.next.split('/')
      if( o.hasOwnProperty( 'items') )
      {
        if( o.items.length > 0 ) {
          oRes.membersList = oRes.membersList.concat( o.items );
          let p = mailgun.getMailListsPages(urlArray[5],urlArray[7], 100)
          p.then(function( success ) { pagesSuccess( { res: success, membersList: oRes.membersList })}, function(err){ console.log(err);});
        } else {
          // We're done grabbing the list!
          ipc.send( 'storeListMembers', { listName: urlArray[5], members: oRes.membersList } );
          document.getElementById('resyncButton').disabled = false;
          renderUserList( oRes.membersList );
        }
      }
    }
  }
}


function reSync() {
  console.log("Resync called");
  document.getElementById('resyncButton').disabled = true;
  document.getElementById('userList').getElementsByTagName('tbody')[0].innerHTML = '';
  let p = mailgun.getMailListsPages(list, '', 100)
  p.then(function( success ) { pagesSuccess( { res: success, membersList: [] })}, function(err){ console.log(err);});
}
