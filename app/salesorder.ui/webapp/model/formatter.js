
sap.ui.define([], function () {
    "use strict";

    // -----------------------------------------------------------------------*
    // Status configuration
    // -----------------------------------------------------------------------*

    var CANCELLED_STATUS_CODE = "CANC";

    var CANCELLABLE_STATUS_CODES = [
        "AACK",
        "OPEN",
        "CONF",
        "CHPR"
    ];


    // -----------------------------------------------------------------------*
    // Internal helper functions
    // -----------------------------------------------------------------------*

    function normalize(sStatus) {
        return String(sStatus || "").toUpperCase();
    }


    function isCancelledStatusImpl(sStatus) {
        return normalize(sStatus) === CANCELLED_STATUS_CODE;
    }


    function isCancellableStatusImpl(sStatus) {
        return CANCELLABLE_STATUS_CODES.indexOf(
            normalize(sStatus)
        ) !== -1;
    }


    function formatYesNoImpl(bValue) {
        return bValue ? "Yes" : "No";
    }


    // -----------------------------------------------------------------------*
    // Formatter object
    // -----------------------------------------------------------------------*

    return {

        // -------------------------------------------------------------------*
        // Status
        // -------------------------------------------------------------------*

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


        // -------------------------------------------------------------------*
        // Yes / No
        // -------------------------------------------------------------------*

        formatYesNo: function (bValue) {
            return formatYesNoImpl(bValue);
        },


        yesNo: function (bValue) {
            return formatYesNoImpl(bValue);
        },


        yesNoText: function (value) {

            return value === "Y"
                ? "Yes"
                : value === "N"
                    ? "No"
                    : value || "";
        },


        // -------------------------------------------------------------------*
        // Customer display
        //
        // Used by:
        //
        // formatter.customerDisplay
        //
        // Example:
        //  "123456 - Customer Name"
        // -------------------------------------------------------------------*

        customerDisplay: function (
            sCustomerCode,
            sCustomerDescription
        ) {

            var sCode = sCustomerCode || "";
            var sDescription = sCustomerDescription || "";

            if (sCode && sDescription) {
                return sCode + " - " + sDescription;
            }

            return sCode || sDescription;
        },


        // -------------------------------------------------------------------*
        // Date
        //
        // Used by:
        //
        // formatter.date
        // -------------------------------------------------------------------*

        date: function (vValue) {

            if (!vValue) {
                return "";
            }

            var oDate = vValue instanceof Date
                ? vValue
                : new Date(vValue);

            if (isNaN(oDate.getTime())) {
                return "";
            }

            return oDate.toLocaleDateString();
        },


        // -------------------------------------------------------------------*
        // Date + Time
        // -------------------------------------------------------------------*

        dateTime: function (vValue) {

            if (!vValue) {
                return "";
            }

            var oDate = vValue instanceof Date
                ? vValue
                : new Date(vValue);

            if (isNaN(oDate.getTime())) {
                return "";
            }

            return oDate.toLocaleString();
        },


        // -------------------------------------------------------------------*
        // Number
        // -------------------------------------------------------------------*

        formatNumber: function (value) {

            if (
                value === null ||
                value === undefined ||
                value === ""
            ) {
                return "";
            }

            var fValue = Number(value);

            if (isNaN(fValue)) {
                return "";
            }

            return fValue.toLocaleString();
        },


        // -------------------------------------------------------------------*
        // Quantity
        //
        // Used by:
        //
        // formatter.quantity
        //
        // Example:
        //  1000       -> 1,000
        //  1000.25    -> 1,000.25
        // -------------------------------------------------------------------*

        quantity: function (vValue) {

            if (
                vValue === null ||
                vValue === undefined ||
                vValue === ""
            ) {
                return "";
            }

            var fValue = Number(vValue);

            if (isNaN(fValue)) {
                return "";
            }

            return fValue.toLocaleString(undefined, {
                maximumFractionDigits: 3
            });
        },


        // -------------------------------------------------------------------*
        // Amount
        //
        // Used by:
        //
        // formatter.amount
        //
        // Example:
        //  100       -> 100.00
        //  1250.5    -> 1,250.50
        // -------------------------------------------------------------------*

        amount: function (vValue) {

            if (
                vValue === null ||
                vValue === undefined ||
                vValue === ""
            ) {
                return "";
            }

            var fValue = Number(vValue);

            if (isNaN(fValue)) {
                return "";
            }

            return fValue.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
        },


        // -------------------------------------------------------------------*
        // Header / line editability
        // -------------------------------------------------------------------*

        isEditableLine: function (status) {

            return !isCancelledStatusImpl(status);
        },


        // -------------------------------------------------------------------*
        // Inline-edit row formatters
        //
        // FDS 3.7.2 editable fields
        // FDS 3.9.6 cancelled-line lockout
        // -------------------------------------------------------------------*

        lineDisplayOnly: function (
            bEditMode,
            mSelectedLines,
            sLineId,
            sLineStatus
        ) {

            if (isCancelledStatusImpl(sLineStatus)) {
                return true;
            }

            return (
                !bEditMode ||
                !mSelectedLines ||
                !mSelectedLines[sLineId]
            );
        },


        lineEditable: function (
            bEditMode,
            mSelectedLines,
            sLineId,
            sLineStatus
        ) {

            if (isCancelledStatusImpl(sLineStatus)) {
                return false;
            }

            return (
                !!bEditMode &&
                !!mSelectedLines &&
                !!mSelectedLines[sLineId]
            );
        },


        // -------------------------------------------------------------------*
        // Cancellation formatters
        // -------------------------------------------------------------------*

        lineCancelReadOnly: function (
            bCancelMode,
            mSelectedLines,
            sLineId,
            sLineStatus
        ) {

            if (isCancelledStatusImpl(sLineStatus)) {
                return true;
            }

            return (
                !bCancelMode ||
                !mSelectedLines ||
                !mSelectedLines[sLineId]
            );
        },


        lineCancelVisible: function (
            bCancelMode,
            mSelectedLines,
            sLineId,
            sLineStatus
        ) {

            if (isCancelledStatusImpl(sLineStatus)) {
                return false;
            }

            return (
                !!bCancelMode &&
                !!mSelectedLines &&
                !!mSelectedLines[sLineId]
            );
        }

    };
});

