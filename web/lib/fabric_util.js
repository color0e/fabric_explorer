var Fabric_Client = require('fabric-client');
var fabric_client = new Fabric_Client();

var path = require('path');
const util = require('util');
var os = require('os');
var store_path = path.join(__dirname,'hfc-key-store');

var member_user = null;
var tx_id = null;

var fs = require('fs');
var config_json = fs.readFileSync('./lib/config.json','utf8');
var config = JSON.parse(config_json);
var cc_info = config.CHAINCODE_INFO;

module.exports=(function(){

	var fabric_util = {};
	var channel = fabric_client.newChannel(config.CHANNEL_NAME);
	var peer = fabric_client.newPeer(config.PEER_ADDRESS);
	channel.addPeer(peer);
	var order = fabric_client.newOrderer(config.ORDERER_ADDRESS);
	channel.addOrderer(order);


	//getAdminCOntext
	fabric_util.getAdminContext = function(){
		const keyPath = path.join(__dirname, util.format('./crypto-config/peerOrganizations/%s.example.com/users/Admin@%s.example.com/msp/keystore', config.userOrg, config.userOrg));
	    const keyPEM = Buffer.from(readAllFiles(keyPath)[0]).toString();
	    const certPath = path.join(__dirname, util.format('./crypto-config/peerOrganizations/%s.example.com/users/Admin@%s.example.com/msp/signcerts', config.userOrg, config.userOrg));
		const certPEM = readAllFiles(certPath)[0];
		
		return Fabric_Client.newDefaultKeyValueStore({path:store_path}).then((state_store) => {
			fabric_client.setStateStore(state_store);

			const cryptoSuite = Fabric_Client.newCryptoSuite();
	
			cryptoSuite.setCryptoKeyStore(Fabric_Client.newCryptoKeyStore({path: store_path}));
			fabric_client.setCryptoSuite(cryptoSuite);
			return fabric_client.createUser({
				username: 'peer'+config.userOrg+'Admin',
				mspid: config.MSPID,
				cryptoContent: {
					privateKeyPEM: keyPEM.toString(),
					signedCertPEM: certPEM.toString()
				}
			});
		});
		}


	//Create Chaincode install request
	fabric_util.chaincodeInstallRequest = function(chaincodeid, chaincodeversion){
        function IsTypeString(value){
            if(value && (typeof value == "string")){
                return true;
            }else{
                console.log(value);
                console.error("type not match STRING");
                return false;
            }
        }
        function IsTypeArray(value){
            if(value.constructor === Array){
                return true;
            }else{
                console.error("type not match ARRAY");
                return false;
            }
        }
        const targets = [];
        targets.push(peer);

        if(IsTypeArray(targets) && IsTypeString(chaincodeid) && IsTypeString(cc_info[0].CHAINCODE_PATH) && IsTypeString(cc_info[0].METADATA_PATH) && IsTypeString(cc_info[0].CHAINCODE_TYPE) && IsTypeString(chaincodeversion)){
            return {
                'targets': targets, //Array.<Peer> or Array.<string>
                'chaincodePath': cc_info[0].CHAINCODE_PATH,
                'chaincodeId': chaincodeid,
                'chaincodeType': cc_info[0].CHAINCODE_TYPE, //golang
                'chaincodeVersion': chaincodeversion //chaincode Version ex:1.0
            };
        }else {
            return {};
        }
	}
	

	//chaincode install
	fabric_util.installchaincode =  function(request,handler,errhandler){
console.log(request);
        return fabric_util.getAdminContext().then((user_from_store) => {

            return fabric_client.installChaincode(request);

        }).then((query_responses) =>{
            handler(query_responses);
        }).catch((err)=>{
            errhandler(err);
        });
	}

	fabric_util.queryinstallchaincode = function(handler,errhandler){
		return fabric_util.getAdminContext().then((user_from_store)=>{
			return fabric_client.queryInstalledChaincodes(peer,true);
		}).then((query_response)=>{
			handler(query_response);
		}).catch((err)=>{
			errhandler(err);
		})
	}

	fabric_util.queryinstantiatechaincode = function(handler,errhandler){
		return fabric_util.getAdminContext().then((user_from_store)=>{
			return channel.queryInstantiatedChaincodes(peer,true);
		}).then((query_response)=>{
			handler(query_response);
		}).catch((err)=>{
			errhandler(err);
		})
	}

	fabric_util.chaincodeInstantiateRequest = function(chaincodeid,chaincodeversion,ctype,fcnname,arg_s){
		function IsTypeString(value){
            if(value && (typeof value == "string")){
                return true;
            }else{
                console.log(value);
                console.error("type not match STRING");
                return false;
            }
        }
        function IsTypeArray(value){
            if(value.constructor === Array){
                return true;
            }else{
                console.error("type not match ARRAY");
                return false;
            }
		}
		
		target=[];
		target.push(peer);

		if(IsTypeArray(target) && IsTypeString(fcnname) && IsTypeArray(arg_s) && IsTypeString(chaincodeid) && IsTypeString(cc_info[0].CHAINCODE_PATH) && IsTypeString(ctype) && IsTypeString(chaincodeversion)){
			const request = {
				targets:target,
				chaincodePath:cc_info[0].CHAINCODE_PATH,
				chaincodeId:chaincodeid,
				chaincodeVersion:chaincodeversion,
				fcn:fcnname,
				args:arg_s,
				txId:'',
				chaincodeType:ctype,
				'endorsement-policy':{
					identities:[
						{role:{name:"member",mspId:"Org1MSP"}},
						{role:{name:"member",mspId:"Org2MSP"}}
					],
					policy: {
						'1-of':[
							{"signed-by":0},{"signed-by":1}
						]
					}
	
				}
			};
			return request;
        }else {
            return {};
        }
	}

	fabric_util.instantiateproposal = function(request){
		return fabric_util.getAdminContext().then((user_from_store)=>{
			tx_id = fabric_client.newTransactionID();
			request.txId = tx_id;
			return channel.sendInstantiateProposal(request,10 * 60 * 1000);
		});
	}

	fabric_util.upgradeproposal = function(request){
		return fabric_util.getAdminContext().then((user_from_store)=>{
			tx_id = fabric_client.newTransactionID();
			request.txId = tx_id;
			return channel.sendUpgradeProposal(request,10 * 60 * 1000);
		});
	}

	fabric_util.instantiatechaincode = function(request,upgrade,handler,errhandler){
		var logic;
		
		if(upgrade){
			
			logic = function(){
				return fabric_util.upgradeproposal(request);
			}

		}else{

			logic = function(){
				return fabric_util.instantiateproposal(request);
		    }
		}
		logic().then((results) => {
            var proposalResponses = results[0];
            var proposal = results[1];
            let isProposalGood = false;

            if (proposalResponses && proposalResponses[0].response && proposalResponses[0].response.status === 200) {
                    isProposalGood = true;
                    console.log('Transaction proposal was good');
            } else {
                console.error('Transaction proposal was bad');
            }

            if(isProposalGood){
                var request = {
                    proposalResponses: proposalResponses,
                    proposal: proposal
                };
          
                return txHandler(request, tx_id, channel, fabric_client);
            }else{
                console.error('Failed to send Proposal or receive valid response. Response null or status is not 200. exiting...');
                throw new Error('Failed to send Proposal or receive valid response. Response null or status is not 200. exiting...');
            }
            
        }).then((results) => {
            return handler(results, tx_id);
        }).catch((err) => {
            return errhandler(err);
        });

        function txHandler(request, tx_id, channel, fabric_client){
	
			// set the transaction listener and set a timeout of 30 sec
			// if the transaction did not get committed within the timeout period,
			// report a TIMEOUT status
			var transaction_id_string = tx_id.getTransactionID(); //Get the transaction ID string to be used by the event processing
			var promises = [];
			
			// console.log(request);
			console.log(channel);
			var sendPromise = channel.sendTransaction(request);
			// sendPromise.catch((e)=>{
			// 	console.log(e);
			// })
			promises.push(sendPromise); //we want the send transaction first, so that we know where to check status
			
			// get an eventhub once the fabric client has a user assigned. The user
			// is required bacause the event registration must be signed
			
			//Error 발생했음 버전상승에 따라서 변경함
			//let event_hub = fabric_client.newEventHub();
			//event_hub.setPeerAddr('grpc://192.168.99.100:7053');
			let event_hub = channel.newChannelEventHub(peer);
			// using resolve the promise so that result status may be processed
			// under the then clause rather than having the catch clause process
			// the status
			let txPromise = new Promise((resolve, reject) => {
				let handle = setTimeout(() => {
					event_hub.disconnect();
					resolve({event_status : 'TIMEOUT'}); //we could use reject(new Error('Trnasaction did not complete within 30 seconds'));
				}, 3000);

				event_hub.connect();

				event_hub.registerTxEvent(transaction_id_string, (tx, code) => {
					// this is the callback for transaction event status
					// first some clean up of event listener
					clearTimeout(handle);
					event_hub.unregisterTxEvent(transaction_id_string);
					event_hub.disconnect();

					// now let the application know what happened
					var return_status = {event_status : code, tx_id : transaction_id_string};
					if (code !== 'VALID') {
						console.error('The transaction was invalid, code = ' + code);
						resolve(return_status); // we could use reject(new Error('Problem with the tranaction, event status ::'+code));
					} else {
						console.log('The transaction has been committed on peer ' + event_hub.getPeerAddr());
						resolve(return_status);
					}
				}, (err) => {
					//this is the callback if something goes wrong with the event registration or processing
					reject(new Error('There was a problem with the eventhub ::'+err));
				});
			});
			promises.push(txPromise);
			console.log(promises);
			return Promise.all(promises);
		
	    }
	}

	fabric_util.getChaincodeRequest = function(chaincodeId, txId, fnc, chainId, args){
        function IsTypeString(value){
            if(value && (typeof value == "string")){
                return true;
            }else{
                console.error("type not match STRING");
                return false;
            }
        }
        function IsTypeArray(value){
            if(value.constructor === Array){
                return true;
            }else{
                console.error("type not match ARRAY");
                return false;
            }
        }
        if(IsTypeString(chaincodeId) && IsTypeString(fnc) && IsTypeString(chainId)  && IsTypeArray(args)){
            return {
                'chaincodeId': chaincodeId,
                'txId': txId,
                'fcn': fnc,
                'chainId': chainId,
                'args': args
            };
        }else {
            return {};
        }
      
    }

	fabric_util.common = function(request,isOnlyQuery){

		return fabric_util.getAdminContext().then((user_from_store)=>{
			if(isOnlyQuery){

				return channel.queryByChaincode(request);
		
			}else{
		
				tx_id = fabric_client.newTransactionID();
				request.txId = tx_id;

				return channel.sendTransactionProposal(request);
		
			}
		});
	}

	fabric_util.invoke = function(request,handler,errhandler){
		let isOnlyQuery = false;
		return fabric_util.common(request,isOnlyQuery).then((results) => {
            var proposalResponses = results[0];
            var proposal = results[1];
            let isProposalGood = false;

            if (proposalResponses && proposalResponses[0].response && proposalResponses[0].response.status === 200) {
                    isProposalGood = true;
                    console.log('Transaction proposal was good');
            } else {
                console.error('Transaction proposal was bad');
            }

            if(isProposalGood){
                var request = {
                    proposalResponses: proposalResponses,
                    proposal: proposal
                };
          
                return txHandler(request, tx_id, channel, fabric_client);
            }else{
                console.error('Failed to send Proposal or receive valid response. Response null or status is not 200. exiting...');
                throw new Error('Failed to send Proposal or receive valid response. Response null or status is not 200. exiting...');
            }
            
        }).then((results) => {
            return handler(results, tx_id);
        }).catch((err) => {
            return errhandler(err);
        });

        function txHandler(request, tx_id, channel, fabric_client){
	
			// set the transaction listener and set a timeout of 30 sec
			// if the transaction did not get committed within the timeout period,
			// report a TIMEOUT status
			var transaction_id_string = tx_id.getTransactionID(); //Get the transaction ID string to be used by the event processing
			var promises = [];
			
			// console.log(request);
			console.log(channel);
			var sendPromise = channel.sendTransaction(request);
			// sendPromise.catch((e)=>{
			// 	console.log(e);
			// })
			promises.push(sendPromise); //we want the send transaction first, so that we know where to check status
			
			// get an eventhub once the fabric client has a user assigned. The user
			// is required bacause the event registration must be signed
			
			//Error 발생했음 버전상승에 따라서 변경함
			//let event_hub = fabric_client.newEventHub();
			//event_hub.setPeerAddr('grpc://192.168.99.100:7053');
			let event_hub = channel.newChannelEventHub(peer);
			// using resolve the promise so that result status may be processed
			// under the then clause rather than having the catch clause process
			// the status
			let txPromise = new Promise((resolve, reject) => {
				let handle = setTimeout(() => {
					event_hub.disconnect();
					resolve({event_status : 'TIMEOUT'}); //we could use reject(new Error('Trnasaction did not complete within 30 seconds'));
				}, 3000);

				event_hub.connect();

				event_hub.registerTxEvent(transaction_id_string, (tx, code) => {
					// this is the callback for transaction event status
					// first some clean up of event listener
					clearTimeout(handle);
					event_hub.unregisterTxEvent(transaction_id_string);
					event_hub.disconnect();

					// now let the application know what happened
					var return_status = {event_status : code, tx_id : transaction_id_string};
					if (code !== 'VALID') {
						console.error('The transaction was invalid, code = ' + code);
						resolve(return_status); // we could use reject(new Error('Problem with the tranaction, event status ::'+code));
					} else {
						console.log('The transaction has been committed on peer ' + event_hub.getPeerAddr());
						resolve(return_status);
					}
				}, (err) => {
					//this is the callback if something goes wrong with the event registration or processing
					reject(new Error('There was a problem with the eventhub ::'+err));
				});
			});
			promises.push(txPromise);
			console.log(promises);
			return Promise.all(promises);
		
	    }
	}

	fabric_util.query = function(request,handler,errhandler){
		let isOnlyQuery = true;
		return fabric_util.common(request,isOnlyQuery).then((query_responses)=>{
			handler(query_responses);
		}).catch((err)=>{
			errhandler(err);
		})
	}
	

	//디렉토리내 모든 파일을 읽음
	function readAllFiles(dir) {
		const files = fs.readdirSync(dir);
		const certs = [];
		files.forEach((file_name) => {
			const file_path = path.join(dir,file_name);
			const data = fs.readFileSync(file_path);
			certs.push(data);
		});
		return certs;
	}



	return fabric_util;
})();
