const transactionModel = require("../models/transaction.model")
const ledgerModel = require("../models/ledger.model")
const emailService = require("../services/email.service")
const accountModel = require("../models/account.model")
const mongoose = require("mongoose")

/**
 * -Create a new transaction
 * 1.Validate request
 * 2. Validate idempotency key
 * 3. Check account status
 * 4. Derive sender balance from ledger
 * 5. Create transaction {PENDING}
 * 6. Create Debit ledger entry
 * 7. Create Credit ledger entry
 * 8. Mark transaction completed
 * 9. Commit MongoDB session
 * 10. Send email notification
 */
async function createTransaction(req, res) {
    /**
     * 1. Validate request
     */
    const { fromAccount, toAccount, amount, idempotencyKey } = req.body
    if (!fromAccount || !toAccount || !amount || !idempotencyKey) {
        return res.status(400).json({
            message: "Missing required feilds"

        })

    }
    const fromUserAccount = await accountModel.findOne({
        _id: fromAccount,
    })
    const toUserAccount = await accountModel.findOne({
        _id: toAccount
    })
    if (!fromUserAccount || !toUserAccount) {
        res.status(400).json({
            message: "Invalid  fromAccount or toAccount"
        })
    }
    /**
     * 2.Validate Idempotency key
     */
    const isTransactionAlreadyExists = await transactionModel.findOne({
        idempotencyKey: idempotencyKey
    })
    if (isTransactionAlreadyExists) {
        if (isTransactionAlreadyExists.status === "COMPLETED") {
            return res.status(200).json({
                message: "Transaction already proceeded",
                transaction: isTransactionAlreadyExists
            })

        }
        if (isTransactionAlreadyExists.status === "PENDING") {
            return res.status(200).json({
                message: "Transaction is still processing"
            })
        }
        if (isTransactionAlreadyExists.status === "FAILED") {
            return res.status(500).json({
                message: "Transaction processing failed"
            })
        }
        if (isTransactionAlreadyExists.status === "REVERSED") {
            return res.status(500).json({
                message: "Transaction are reversed , please retry"
            })
        }

    }


    /**
     * 3. Check account status
     * await (() => {
        return new Promise((resolve) => setTimeout(resolve, 100*100));
    })()
     */
    if (fromUserAccount.status !== "ACTIVE" || toUserAccount.status !== "ACTIVE") {
        return res.status(400).json({
            message: "Either FromUser or ToUser account is inactive or freezed"
        })
    }
    /**
     * 4. Derive sender balance from ledger
     */

    const balance = await fromUserAccount.getBalance()
    if (balance < amount) {
        return res.status(400).json({
            message: `Insufficient balance, Current balance is ${balance}. Requested amount is ${amount}`

        })
    }
    let transaction;
    try {
        /**
         * 5. Create Transactions (PENDING)
         */
        const session = await mongoose.startSession()
        session.startTransaction()

        transaction = (await transactionModel.create([{
            fromAccount,
            toAccount,
            amount,
            idempotencyKey,
            status: "PENDING"

        }], { session }))[0]
        const debitLedgerEntry = await ledgerModel.create([{
            account: fromAccount,
            amount: amount,
            transaction: transaction._id,
            type: "DEBIT"

        }], { session })
        await (() => {
            return new Promise((resolve) => setTimeout(resolve, 50 * 100));
        })()

        const creditLedgerEntry = await ledgerModel.create([{
            account: toAccount,
            amount: amount,
            transaction: transaction._id,
            type: "CREDIT"

        }], { session })

        await transactionModel.findOneAndUpdate(
            { _id: transaction._id },
            { status: "COMPLETED" },
            { session }
        )

        await session.commitTransaction()
        session.endSession();
    } catch (error) {
        return res.status(400).json({
            message: "Transaction is Pending due to some issues , please try after some time "
        })
    }

    /**
     * 10. Send email
     */
    await emailService.sendTransactionEmail(
        req.user.email, req.user.name, amount, toUserAccount
    )
    return res.status(201).json({
        message: "Transaction completed successfully",
        transaction: transaction
    })
}
async function createInitialFundsTransaction(req, res) {
    console.log("req.user", req.user);
    console.log(await accountModel.find({ systemUser: true }));

    const { toAccount, amount, idempotencyKey } = req.body
    if (!toAccount || !amount || !idempotencyKey) {
        return res.status(400).json({
            message: "to Account , amount or idempotency key is missing"

        })

    }
    const toUserAccount = await accountModel.findOne({
        _id: toAccount,

    })
    if (!toUserAccount) {
        return res.status(400).json({
            message: "Invalid toUserAccount"
        })
    }
    const fromUserAccount = await accountModel.findOne({

        systemUser: true,

    })
    if (!fromUserAccount) {
        return res.status(400).json({
            message: "System user account unable to find"

        })
    }
    const session = await mongoose.startSession()
    session.startTransaction()
    const transaction = new transactionModel({
        fromAccount: fromUserAccount._id,
        toAccount,
        amount,
        idempotencyKey,
        status: "PENDING"

    })
    const debitLedgerEntry = await ledgerModel.create([{
        account: fromUserAccount._id,
        amount: amount,
        transaction: transaction._id,
        type: "DEBIT"

    }], { session })
    const creditLedgerEntry = await ledgerModel.create([{
        account: toAccount,
        amount: amount,
        transaction: transaction._id,
        type: "CREDIT"

    }], { session })
    transaction.status = "COMPLETED"
    await transaction.save({ session })
    await session.commitTransaction()
    session.endSession()
    return res.status(201).json({
        message: "Initial funds transaction completed successfully",
        transaction: transaction
    })
}
module.exports = { createTransaction, createInitialFundsTransaction }
