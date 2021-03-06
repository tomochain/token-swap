'use strict'

const db = require('./models')
const BigNumber = require('bignumber.js')

BigNumber.config({ EXPONENTIAL_AT: [-100, 100] })
async function getTransactions () {
    return db.Transaction.find({ isProcess: false })
}
async function main () {
    let transactions = await getTransactions()
    while (transactions.length > 0) {
        console.log('Processing %s transactions...', transactions.length)
        for (let i = 0; i < transactions.length; i++) {
            if (i % 100 === 0) {
                console.log('process items ', i)
            } else if (i === transactions.length) {
                console.log('process last item')
            }

            let tx = transactions[i]
            let amount = new BigNumber(tx.amount)

            let fromAccount = await db.Account.findOne({ hash: tx.fromAccount.toLowerCase() })
            if (!fromAccount) {
                fromAccount = { hash: tx.fromAccount.toLowerCase(), balance: '0' }
            }
            let balanceFrom = new BigNumber(fromAccount.balance)
            balanceFrom = balanceFrom.minus(amount)
            await db.Account.updateOne({ hash: tx.fromAccount.toLowerCase() }, {
                hash: tx.fromAccount.toLowerCase(),
                balance: balanceFrom.toString(),
                balanceNumber: balanceFrom.dividedBy(10 ** 18).toNumber()
            }, { upsert: true })

            let toAccount = await db.Account.findOne({ hash: tx.toAccount.toLowerCase() })
            if (!toAccount) {
                toAccount = { hash: tx.toAccount.toLowerCase(), balance: '0' }
            }
            let balanceTo = new BigNumber(toAccount.balance)
            balanceTo = balanceTo.plus(amount)
            await db.Account.updateOne({ hash: tx.toAccount.toLowerCase() }, {
                hash: tx.toAccount.toLowerCase(),
                balance: balanceTo.toString(),
                balanceNumber: balanceTo.dividedBy(10 ** 18).toNumber()
            }, { upsert: true })
            tx.isProcess = true
            await tx.save()
        }
        transactions = await getTransactions()
    }

    console.log('Finished process')
    process.exit(0)
}

main()
