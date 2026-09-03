sap.ui.define([], function () {
    "use strict";

    return {
        statusState: function (status) {
            switch (String(status || "").toUpperCase()) {
                case "CONFIRMED":
                case "DELIVERED":
                case "INVOICED":
                case "RECEIVED":
                    return "Success";

                case "CANCELLED":
                case "REJECTED":
                    return "Error";

                case "AWAITING ACK":
                case "AWAITING_ACK":
                case "NEW - AWAITING ACK":
                case "PARTIALLY SHIPPED":
                case "PARTIALLY_SHIPPED":
                case "CHANGE PROCESSING":
                    return "Warning";

                default:
                    return "Information";
            }
        },
        isFieldEditable: function (bEditMode, sLineStatus) {
            return !!bEditMode && sLineStatus !== "CNCL";
        },

        isFieldReadOnly: function (bEditMode, sLineStatus) {
            return !bEditMode || sLineStatus === "CNCL";
        },

        formatYesNo: function (bValue) {
            return bValue ? "Yes" : "No"; // swap for i18n-resourced text if needed
        },

        isEditableLine: function (status) {
            var value = String(status || "").toUpperCase();
            return [
                "AWAITING ACK",
                "AWAITING_ACK",
                "OPEN",
                "CONFIRMED",
                "PARTIALLY SHIPPED",
                "PARTIALLY_SHIPPED"
            ].indexOf(value) !== -1;
        },

        yesNoText: function (value) {
            return value === "Y" ? "Yes" : value === "N" ? "No" : value || "";
        },

        formatNumber: function (value) {
            if (value === null || value === undefined || value === "") {
                return "";
            }
            return Number(value).toLocaleString();
        },

        // -----------------------------------------------------------------------*
        // Inline-edit row formatters for the Sales Order Items table
        // (FDS 3.7.2 editable fields, 3.9.6 cancelled-line lockout)
        //
        // These are multi-part formatters, bound in the view like:
        //   visible="{parts: ['view>/itemsEditMode', 'view>/selectedLines',
        //             'lineId', 'lineStatus'], formatter: '.formatter.lineEditable'}"
        //
        // A row's cell shows its Input/Select control only when:
        //   1) the table is in the matching mode (edit or cancel), AND
        //   2) that specific row is ticked, AND
        //   3) the row's status is not Cancelled - a cancelled line permits
        //      no action at all, ticked or not (FDS 3.9.6).
        //
        // NOTE: statusState/isEditableLine above compare against "CANCELLED",
        // while isFieldEditable/isFieldReadOnly compare against "CNCL" - that
        // looks like a leftover inconsistency between two status code schemes.
        // The functions below match the "CANCELLED" convention used by
        // statusState/isEditableLine. Confirm which status code your service
        // actually returns and adjust the constant below if it turns out to be
        // "CNCL" instead.
        // -----------------------------------------------------------------------*

        _CANCELLED_STATUS: "CANCELLED",

        /**
         * True when this row's cell should show its Text (read-only) control -
         * i.e. NOT in Items edit mode, OR this row isn't ticked, OR this row's
         * status is Cancelled.
         */
        lineDisplayOnly: function (bEditMode, mSelectedLines, sLineId, sLineStatus) {
            if (String(sLineStatus || "").toUpperCase() === this._CANCELLED_STATUS) {
                return true;
            }
            return !bEditMode || !mSelectedLines || !mSelectedLines[sLineId];
        },

        /**
         * True when this row's cell should show its Input/Select control.
         * Exact inverse of lineDisplayOnly, written without relying on `this`
         * binding inside a multi-part formatter call.
         */
        lineEditable: function (bEditMode, mSelectedLines, sLineId, sLineStatus) {
            if (String(sLineStatus || "").toUpperCase() === this._CANCELLED_STATUS) {
                return false;
            }
            return !!bEditMode && !!mSelectedLines && !!mSelectedLines[sLineId];
        },

        /**
         * Reason for Cancellation cell, read-only (Text) variant - shown while
         * NOT in Cancel Line mode, OR this row isn't ticked, OR it's already
         * Cancelled.
         */
        lineCancelReadOnly: function (bCancelMode, mSelectedLines, sLineId, sLineStatus) {
            if (String(sLineStatus || "").toUpperCase() === this._CANCELLED_STATUS) {
                return true;
            }
            return !bCancelMode || !mSelectedLines || !mSelectedLines[sLineId];
        },

        /**
         * Reason for Cancellation cell, editable dropdown variant - shown only
         * in Cancel Line mode, on a ticked, still-cancellable row.
         */
        lineCancelVisible: function (bCancelMode, mSelectedLines, sLineId, sLineStatus) {
            if (String(sLineStatus || "").toUpperCase() === this._CANCELLED_STATUS) {
                return false;
            }
            return !!bCancelMode && !!mSelectedLines && !!mSelectedLines[sLineId];
        }
    };
});