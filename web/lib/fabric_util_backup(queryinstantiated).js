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
