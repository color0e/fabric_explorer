var fabric_util = require('./lib/fabric_util.js');
var request = fabric_util.chaincodeInstallRequest("marbles02","2.0");
var request2 = fabric_util.chaincodeInstantiateRequest("marbles02","2.0","golang","init",['']);


var handler = function(results){
    const proposalResponses = results[0];

                        let all_good = true;
                        const errors = [];
                        for (const i in proposalResponses) {
                                let one_good = false;
                                if (proposalResponses && proposalResponses[i].response && proposalResponses[i].response.status === 200) {
                                        one_good = true;
                                        console.log('install proposal was good');
                                } else {
                                        console.log('install proposal was bad');
                                        errors.push(proposalResponses[i]);
                                }
                                all_good = all_good & one_good;
                        }
                        if (all_good) {
                                console.log('Successfully sent install Proposal and received ProposalResponse: Status - %s'+proposalResponses[0].response.status);
                        } else {
                                throw new Error(util.format('Failed to send install Proposal or receive valid response: %s', errors));
                        }
}
var errhandler = function(err){
    console.log(err);
}


/*
results - ChaincodeInfo
property:
name - string
version - string
path - string
input - string
escc - string
vscc string
*/

/*
var qcihandler = function(results){
    var chaincodes = results.chaincodes;
    console.log("-- Installed chaincode list --");
    for(const i in chaincodes){
    console.log(chaincodes[i].name+" "+chaincodes[i].version+" "+chaincodes[i].path);
    }
}

var qcihandler2 = function(results){
    var chaincodes = results.chaincodes;
    console.log("-- Instantiated chaincode list --");
    for(const i in chaincodes){
    console.log(chaincodes[i].name+" "+chaincodes[i].version+" "+chaincodes[i].path+" "+chaincodes[i].input+" "+chaincodes[i].escc+" "+chaincodes[i].vscc);
    }
}

var errhandler = function(err){
    console.log(err);
}
fabric_util.queryinstallchaincode(qcihandler,errhandler).then(()=>{
    fabric_util.queryinstantiatechaincode(qcihandler2,errhandler);
});
*/
var Handler = function(results, tx_id) {
	console.log('Send transaction promise and event listener promise have completed');
	// check the results in the order the promises were added to the promise all list
	function isAvailalbe(data, data_index, data_key, statement){
		if(data  && data[data_index] && data[data_index][data_key] === statement){
			return true;
		}
		return false;
	}
	if (isAvailalbe(results, 0, "status", "SUCCESS")) {
		// if (results && results[0] && results[0].status === 'SUCCESS') {
		console.log('Successfully sent transaction to the orderer.');
		// res.send(tx_id.getTransactionID());
	} else {
		// console.error('Failed to order the transaction. Error code: ' + response.status);
	}

	if(isAvailalbe(results, 1, "event_status", "VALID")) {
		// if(results && results[1] && results[1].event_status === 'VALID') {
		console.log('Successfully committed the change to the ledger by the peer');
        console.log(tx_id.getTransactionID());
        //res.send(tx_id.getTransactionID());
	} else {
		console.log('Transaction failed to be committed to the ledger due to ::'+results[1].event_status);
	}
}
var errHandler = function(err){
    console.log(err);
}
console.log("-- [first] marbles02 chaincode install --");
fabric_util.installchaincode(request,handler,errhandler).then(()=>{
    console.log("-- [second] marbles02 chaincode instantiate and upgrade --");
    fabric_util.instantiatechaincode(request2,true,Handler,errHandler);
});


