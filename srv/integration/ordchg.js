//---------------------------------------------------------------------------------*
// Confidential and Proprietary
// Copyright 2026, HP
// All Rights Reserved
//---------------------------------------------------------------------------------*
// Builds the ORDCHG payload shape for a line cancellation.
//
// NOTE: SAP Integration Suite / ORDCHG IDoc transport is explicitly out of
// scope for this pass - this only builds the payload object for logging, it
// does not send it anywhere.
//---------------------------------------------------------------------------------*

function buildCancelLineOrdchgPayload({ hpSalesOrder, lineId, reasonCode, userId }) {
    return {
        salesOrderNumber: hpSalesOrder,
        lineItemNumber: lineId,
        cancellationIndicator: true,
        reasonForCancellation: reasonCode, // ABGRU
        userId,
        timestamp: new Date().toISOString()
    };
}

module.exports = { buildCancelLineOrdchgPayload };
