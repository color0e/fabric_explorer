var fs = require('fs');
var config_json = fs.readFileSync('./config.json','utf8');
var config = JSON.parse(config_json);

console.log(config.PEER_ADDRESS);
console.log(config.ORDERER_ADDRESS);

var chaincode_info = config.CHAINCODE_INFO;

for(var i in chaincode_info){
console.log(chaincode_info[i].CHAINCODE_ID);
}
