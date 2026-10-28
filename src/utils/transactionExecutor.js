const mongoose = require('mongoose');
const { getIsReplicaSet } = require('../config/database');

/**
 * Executes a function within a MongoDB session transaction if replica set is available,
 * otherwise executes without a session (allowing caller to use atomic document updates).
 *
 * @param {Function} work - async function(session) that receives mongoose session (or null)
 * @returns {Promise<any>}
 */
const runInTransaction = async (work) => {
  const isReplica = getIsReplicaSet();

  if (!isReplica) {
    // Standalone MongoDB does not support multi-document transactions.
    // Execute directly with null session (caller uses atomic operations + compensating rollback)
    return await work(null);
  }

  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const result = await work(session);
    await session.commitTransaction();
    return result;
  } catch (error) {
    try {
      await session.abortTransaction();
    } catch (abortErr) {
      // Transaction may have already been aborted
    }
    throw error;
  } finally {
    await session.endSession();
  }
};

module.exports = {
  runInTransaction,
};
