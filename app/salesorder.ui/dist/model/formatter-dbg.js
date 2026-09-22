sap.ui.define([], function () {
    "use strict";

    // Single source of truth for line/header status codes - matches the real
    // seeded LineStatuses/SalesOrderStatuses data (AACK, OPEN, CONF, CHPR,
    // PSHP, SHIP, DLVD, INVD, CANC). CHPR (Change Processing) is tolerated
    // defensively in the cancellable set for forward-compat with Phase 2,
    // even though the backend cannot produce it yet.
    var CANCELLED_STATUS_CODE = "CANC";
    var CANCELLABLE_STATUS_CODES = ["AACK", "OPEN", "CONF", "CHPR"];

    function normalize(sStatus) {
        return String(sStatus || "").toUpperCase();
    }

    // Plain closures, not exported methods - safe to call from anywhere in
    // this module without relying on `this`, which UI5 does NOT guarantee to
    // be bound to this module object when invoking a ".formatter.xxx" binding.
    function isCancelledStatusImpl(sStatus) {
        return normalize(sStatus) === CANCELLED_STATUS_CODE;
    }

    function isCancellableStatusImpl(sStatus) {
        return CANCELLABLE_STATUS_CODES.indexOf(normalize(sStatus)) !== -1;
    }

    function formatYesNoImpl(bValue) {
        return bValue ? "Yes" : "No"; // swap for i18n-resourced text if needed
    }

    return {

        isCancelledStatus: function (sStatus) {
            return isCancelledStatusImpl(sStatus);
        },

        isCancellableStatus: function (sStatus) {
            return isCancellableStatusImpl(sStatus);
        },

        statusState: function (status) {
            switch (normalize(status)) {
                case "CONF":
                case "DLVD":
                case "INVD":
                    return "Success";

                case "CANC":
                    return "Error";

                case "AACK":
                case "OPEN":
                case "CHPR":
                case "PSHP":
                    return "Warning";

                default:
                    return "Information";
            }
        },

        statusIcon: function (status) {
            switch (normalize(status)) {
                case "CONF":
                case "DLVD":
                case "INVD":
                    return "sap-icon://sys-enter-2";

                case "CANC":
                    return "sap-icon://sys-cancel-2";

                case "AACK":
                case "OPEN":
                case "CHPR":
                case "PSHP":
                    return "sap-icon://warning";

                default:
                    return "sap-icon://message-information";
            }
        },

        formatYesNo: function (bValue) {
            return formatYesNoImpl(bValue);
        },

        yesNo: function (bValue) {
            return formatYesNoImpl(bValue);
        },

        isEditableLine: function (status) {
            return !isCancelledStatusImpl(status);
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

        dateTime: function (vValue) {
            if (!vValue) {
                return "";
            }
            var oDate = vValue instanceof Date ? vValue : new Date(vValue);
            if (isNaN(oDate.getTime())) {
                return "";
            }
            return oDate.toLocaleString();
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
        // -----------------------------------------------------------------------*

        /**
         * True when this row's cell should show its Text (read-only) control -
         * i.e. NOT in Items edit mode, OR this row isn't ticked, OR this row's
         * status is Cancelled.
         */
        lineDisplayOnly: function (bEditMode, mSelectedLines, sLineId, sLineStatus) {
            if (isCancelledStatusImpl(sLineStatus)) {
                return true;
            }
            return !bEditMode || !mSelectedLines || !mSelectedLines[sLineId];
        },

        /**
         * True when this row's cell should show its Input/Select control.
         * Exact inverse of lineDisplayOnly.
         */
        lineEditable: function (bEditMode, mSelectedLines, sLineId, sLineStatus) {
            if (isCancelledStatusImpl(sLineStatus)) {
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
            if (isCancelledStatusImpl(sLineStatus)) {
                return true;
            }
            return !bCancelMode || !mSelectedLines || !mSelectedLines[sLineId];
        },

        /**
         * Reason for Cancellation cell, editable dropdown variant - shown only
         * in Cancel Line mode, on a ticked, still-cancellable row.
         */
        lineCancelVisible: function (bCancelMode, mSelectedLines, sLineId, sLineStatus) {
            if (isCancelledStatusImpl(sLineStatus)) {
                return false;
            }
            return !!bCancelMode && !!mSelectedLines && !!mSelectedLines[sLineId];
        }
    };
});
