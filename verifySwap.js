const { web3EthRpc, web3Tomo } = require('./web3')
const config = require('config')
const db = require('./models')
const TomoABI = require('./files/tomocoin')
const BigNumber = require('bignumber.js')
const events = require('events')

// fix warning max listener
events.EventEmitter.defaultMaxListeners = 1000
process.setMaxListeners(1000)

let sleep = (time) => new Promise((resolve) => setTimeout(resolve, time))
var coinbase = ''
var tomoContract = new web3EthRpc.eth.Contract(TomoABI, config.get('tomoAddress'))
BigNumber.config({ EXPONENTIAL_AT: [-100, 100] })

async function getAccounts(skip, limit) {
    return db.Account.find({
        accountType: 'normal'
    }).sort({balanceNumber: 1}).limit(limit).skip(skip)
}

function getErc20Balance(address) {
    return tomoContract.methods.balanceOf(address).call().catch(e => {
        console.error('cannot get balance on Tomo contract (Ethereum network)', address)
        console.log('Sleep 2 seconds and re-getErc20Balance until done')
        return sleep(2000).then(() => {
            return getErc20Balance(address)
        })
    })
}

function getTomoBalance(address) {
    return web3Tomo.eth.getBalance(address).catch(e => {
        console.error('cannot get TOMO balance account', address)
        console.log('Sleep 2 second and re-getTomoBalance until done')
        return sleep(2000).then(() => {
            return getTomoBalance(address)
        })
    })
}

async function main() {
    console.log('Start process at', new Date())
    try {
        coinbase = await web3Tomo.eth.getCoinbase()
    } catch (e) {
        console.log('Cannot start by error', String(e))
        process.exit(1)
    }

    let page = 1 
    let limit = 100
    let skip = 0
    let total = 0
    let accounts = await getAccounts(skip, limit)
    let bad = []
    while (accounts.length > 0) {
        let map = accounts.map(async function (account, index) {
            total++
            let balanceOnEth = await getErc20Balance(account.hash)
            let currentBalance = await getTomoBalance(account.hash)
            let b = String(balanceOnEth) === String(currentBalance)
            console.log('ERC20', String(balanceOnEth), 'TOMO', String(currentBalance), b)
            if (!b) {
                bad.push({
                    address: account.hash,
                    balanceOnEth: balanceOnEth,
                    currentBalance: currentBalance
                })
            }
        })

        await Promise.all(map)

        page++ 
        skip = limit * (page - 1)
        accounts = await getAccounts(skip, limit)
    }

    console.log(bad)
    console.log('Result: total %s, bad %s', total, bad.length)
    console.log('Finish process at', new Date())
    process.exit(0)
}

main()