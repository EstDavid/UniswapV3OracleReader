// WEB3 CONFIG
const Web3 = require('web3');
const web3 = new Web3(process.env.RPC_URL);

const BigNumber = require('bignumber.js');

const decimalPlaces = 18;

const noDenomination = 'NoDenomination';

BigNumber.set({ DECIMAL_PLACES: decimalPlaces, ROUNDING_MODE: 4 })

/* function convertToWei(amount, decimals) {
    let amountWei = "";
    if(decimals === 18) {
      amountWei = web3.utils.toWei(amount.toString(), 'ether')
    } else {
        let amountString = amount.toString()
        let dotPosition = amountString.indexOf(".");
        if(dotPosition === -1) {
            for(let i = 0; i < decimals; i++) {
                amountString += "0";
            }
            amountWei = amountString;
        } else {
            [integerValue, decimalValue] = amountString.toString().split(".");
            if(decimalValue.length > decimals) {
                let integerArray = Array.from(integerValue);
                let decimalArray = Array.from(decimalValue);
                let completeArray = integerArray.concat(decimalArray);
                for(let i = 0; i < completeArray.length; i++) {
                    completeArray[i] = parseInt(completeArray[i]);
                }
                let decimalPlace = 0;
                for(let i = completeArray.length - 1; i > 0; i--) {
                    let roundOffDecimal = false;
                    if(decimalPlace < decimalArray.length - decimals) {
                        roundOffDecimal = true;
                    }
                    decimalPlace += 1;
                    if(completeArray[i] >= 5 && roundOffDecimal ) {
                        completeArray[i-1] += 1;
                        completeArray[i] = 0;
                    }
                    else if(completeArray[i] > 9) {
                        completeArray[i-1] += 1;
                        completeArray[i] = 0;
                    }
                }
                for(let i = 0; i < integerArray.length + decimals; i++) {
                    amountWei += completeArray[i];
                }
            } else {
                for(let i = decimalValue.length; i < decimals; i++) {
                    decimalValue += "0";
                }
                amountWei = integerValue + decimalValue;
            }
        }
    }
    amountWei = new web3.utils.BN(amountWei).toString();
    return amountWei;
}
  
  function convertFromWei(amount, decimals) {
    amount = amount.toString();
    let outputAmount;
    if(decimals === 18) {
        outputAmount = web3.utils.fromWei(amount, 'ether')
      } else if(amount.length <= decimals) {
      outputAmount = "0.";
      for(let i = amount.length; i < decimals; i+=1) {
        outputAmount += "0";
      }
      outputAmount += amount;
    } else {
      let integerValue = amount.slice(0, amount.length - decimals);
      let decimalValue = amount.slice(amount.length -  decimals);
      outputAmount = integerValue + "." + decimalValue;
    }
    if(outputAmount.includes(".")) {
        let zerosToRemove = 0;
        for(let i = outputAmount.length - 1; i > 0; i-=1) {
            if(outputAmount[i] !== "0" || outputAmount[i] === ".") {
                break;
            } else if (outputAmount[i] === "0") {
                zerosToRemove += 1;
            }
        }
        outputAmount = outputAmount.slice(0, outputAmount.length - zerosToRemove);
        if(outputAmount[outputAmount.length - 1] === ".") {
            outputAmount = outputAmount.slice(0, -1);
        }
    }
    return outputAmount;
} */

function convertToWei(amount, decimals) {
    let initialAmount = new BigNumber(amount);
    let amountWei = "";
    let denomination = getDenomination(decimals);
    if(denomination !== noDenomination) {
      amountWei = web3.utils.toWei(initialAmount.decimalPlaces(decimals).toString(), denomination)
    } else {
        amountWei = initialAmount.shiftedBy(decimals).toFixed(0).toString();
    }
    return amountWei;
}
  
function convertFromWei(amount, decimals) {
    let initialAmount = new BigNumber(amount);   
    let outputAmount = "";
    let denomination = getDenomination(decimals);
    if(denomination !== noDenomination) {
        outputAmount = web3.utils.fromWei(initialAmount.toFixed().toString(), denomination);
      }
    else {
        outputAmount = initialAmount.shiftedBy(-decimals).toFixed(decimals).toString();
    }
    return outputAmount;
}

function getDenomination(decimals) {
    let denomination;

    switch(decimals) {
        case 3:
            denomination = 'Kwei';
            break;
        
        case 6: 
            denomination = 'Mwei';
            break;

        case 9:
            denomination = 'Gwei';
            break;
        
        case 12:
            denomination = 'szabo';
            break;

        case 15:
            denomination = 'finney';
            break;

        case 18:
            denomination = 'ether';
            break;

        default:
            denomination = noDenomination;
    }
    return denomination;
}

function isCorrectNumber(number) {
    try {
        let output = new BigNumber(number);
        if(output.e === null && output.c === null) {
            throw('Error converting number');
        }
    } catch {
        return false;
    }
    return true;
}

exports.convertToWei = convertToWei;

exports.convertFromWei = convertFromWei;

exports.isCorrectNumber = isCorrectNumber;