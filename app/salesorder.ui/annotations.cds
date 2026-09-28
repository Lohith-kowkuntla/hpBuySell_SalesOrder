using HpBuySellOtcSalesOrderService as service from '../../srv/hpbuysell-otc-salesorder-service';

//-----------------------------------------------------------------------------------*
// Search Filter control types (FDS UI Mapping Sheet)
//
// SalesOrderSearchExport projects these as flat scalar columns
// (salesOrder.salesOrderStatus.code as salesOrderStatus, etc.), so CAP's
// automatic Common.ValueList generation - which only fires for an
// association's own foreign-key element, e.g. SalesOrders.salesOrderStatus_code
// - never reaches them; the flattened column has no value-list metadata at
// all today. Without Common.ValueList + Common.ValueListWithFixedValues,
// SmartFilterBar has no basis to render anything but a generic Search Filter
// (Input + optional Value Help), which is exactly the reported bug. These
// annotations are what actually drives the control type - the client-side
// VALUE_HELP_CONFIG in SalesOrderOverview.controller.js only supplies the
// ValueHelpDialog fallback for genuinely open-ended Search Filter fields.
//-----------------------------------------------------------------------------------*

annotate service.SalesOrderSearchExport with {

    // ---------------------------------------------------------------
    // Dropdown With Values - LineStatuses/SalesOrderStatuses. The code
    // column IS the business value ("Open", "Confirmed", ...), never a
    // SAP technical code, so a single InOut parameter is sufficient - the
    // dropdown already shows business text.
    // ---------------------------------------------------------------

    salesOrderStatus @(
        Common.ValueListWithFixedValues: true,
        Common.ValueList                : {
            Label         : '{i18n>soHeader.salesOrderStatus}',
            CollectionPath: 'VH_OrderStatus',
            Parameters    : [
                {
                    $Type            : 'Common.ValueListParameterInOut',
                    LocalDataProperty: salesOrderStatus,
                    ValueListProperty: 'code'
                }
            ]
        }
    );

    lineStatus @(
        Common.ValueListWithFixedValues: true,
        Common.ValueList                : {
            Label         : '{i18n>soItem.lineStatus}',
            CollectionPath: 'VH_LineStatus',
            Parameters    : [
                {
                    $Type            : 'Common.ValueListParameterInOut',
                    LocalDataProperty: lineStatus,
                    ValueListProperty: 'code'
                }
            ]
        }
    );

    // ---------------------------------------------------------------
    // Dropdown With Values - technical code persisted, friendly name
    // shown via a display-only parameter (VH_* now project code + name).
    // ---------------------------------------------------------------

    salesOrderOrigin @(
        Common.ValueListWithFixedValues: true,
        Common.ValueList                : {
            Label         : '{i18n>soHeader.salesOrderOrigin}',
            CollectionPath: 'VH_SalesOrderOrigin',
            Parameters    : [
                {
                    $Type            : 'Common.ValueListParameterInOut',
                    LocalDataProperty: salesOrderOrigin,
                    ValueListProperty: 'code'
                },
                {
                    $Type            : 'Common.ValueListParameterDisplayOnly',
                    ValueListProperty: 'name'
                }
            ]
        }
    );

    soAckOutOrigin @(
        Common.ValueListWithFixedValues: true,
        Common.ValueList                : {
            Label         : '{i18n>soItem.soAckOutOrigin}',
            CollectionPath: 'VH_SoAckOutOrigin',
            Parameters    : [
                {
                    $Type            : 'Common.ValueListParameterInOut',
                    LocalDataProperty: soAckOutOrigin,
                    ValueListProperty: 'code'
                },
                {
                    $Type            : 'Common.ValueListParameterDisplayOnly',
                    ValueListProperty: 'name'
                }
            ]
        }
    );

    // SO Change IN Origin draws from the same domain of values as Sales
    // Order Origin, so it reuses VH_SalesOrderOrigin rather than a second
    // hand-maintained list.
    soChangeInOrigin @(
        Common.ValueListWithFixedValues: true,
        Common.ValueList                : {
            Label         : '{i18n>soItem.soChangeInOrigin}',
            CollectionPath: 'VH_SalesOrderOrigin',
            Parameters    : [
                {
                    $Type            : 'Common.ValueListParameterInOut',
                    LocalDataProperty: soChangeInOrigin,
                    ValueListProperty: 'code'
                },
                {
                    $Type            : 'Common.ValueListParameterDisplayOnly',
                    ValueListProperty: 'name'
                }
            ]
        }
    );

    reasonForCancellation @(
        Common.ValueListWithFixedValues: true,
        Common.ValueList                : {
            Label         : '{i18n>soItem.reasonForCancellation}',
            CollectionPath: 'VH_ReasonForCancellation',
            Parameters    : [
                {
                    $Type            : 'Common.ValueListParameterInOut',
                    LocalDataProperty: reasonForCancellation,
                    ValueListProperty: 'code'
                },
                {
                    $Type            : 'Common.ValueListParameterDisplayOnly',
                    ValueListProperty: 'name'
                }
            ]
        }
    );

    // ---------------------------------------------------------------
    // Dropdown With Values - boolean, Y/N per FDS.
    // ---------------------------------------------------------------

    specialDealFlagSo @(
        Common.ValueListWithFixedValues: true,
        Common.ValueList                : {
            Label         : '{i18n>soItem.specialDealFlagSo}',
            CollectionPath: 'VH_SpecialDealFlag',
            Parameters    : [
                {
                    $Type            : 'Common.ValueListParameterInOut',
                    LocalDataProperty: specialDealFlagSo,
                    ValueListProperty: 'code'
                },
                {
                    $Type            : 'Common.ValueListParameterDisplayOnly',
                    ValueListProperty: 'description'
                }
            ]
        }
    );

    // ---------------------------------------------------------------
    // Fixed Dropdown - ZBLB / ZCBS / ZICB (FDS-mandated exact set).
    // ---------------------------------------------------------------

    salesOrderType @(
        Common.ValueListWithFixedValues: true,
        Common.ValueList                : {
            Label         : '{i18n>soHeader.salesOrderType}',
            CollectionPath: 'VH_SalesOrderType',
            Parameters    : [
                {
                    $Type            : 'Common.ValueListParameterInOut',
                    LocalDataProperty: salesOrderType,
                    ValueListProperty: 'code'
                },
                {
                    $Type            : 'Common.ValueListParameterDisplayOnly',
                    ValueListProperty: 'name'
                }
            ]
        }
    );
};
