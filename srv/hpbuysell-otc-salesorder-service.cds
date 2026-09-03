using {hpbuysell.otc.salesorder as db} from '../db/hpbuysell-otc-salesorder-model';

@path    : 'salesorder'
@requires: 'authenticated-user'
service HpBuySellOtcSalesOrderService {

    // ==========================================================================
    // Roles
    //   SalesOrderManage  - full access: read + update + all actions
    //   SalesOrderViewer  - read-only access to every field, on every entity
    // ==========================================================================

    @title                 : '{i18n>SalesOrders}'
    @cds.redirection.target: true
    @restrict              : [
        {
            grant: ['READ'],
            to   : [
                'SalesOrderManage',
                'SalesOrderViewer'
            ]
        },
        {
            grant: ['UPDATE'],
            to   : ['SalesOrderManage']
        }
    ]
    entity SalesOrders                as projection on db.SalesOrders
        actions {

            /** Applies pending header/item edits and triggers the ORDCHG IDoc (FDS 3.10) */
            @title   : '{i18n>action.updateSalesOrder}'
            @requires: 'SalesOrderManage'
            action updateSalesOrder() returns UpdateResult;
        };

    @title                 : '{i18n>SalesOrderItems}'
    @cds.redirection.target: true
    @restrict              : [
        {
            grant: ['READ'],
            to   : [
                'SalesOrderManage',
                'SalesOrderViewer'
            ]
        },
        {
            grant: ['UPDATE'],
            to   : ['SalesOrderManage']
        }
    ]
    entity SalesOrderItems            as projection on db.SalesOrderItems
        actions {

            /** Cancels the line, sets status Cancelled immediately, triggers ORDCHG (FDS 3.9.2) */
            @title   : '{i18n>action.cancelLine}'
            @requires: 'SalesOrderManage'
            action cancelLine(
                              @title: '{i18n>action.cancelLine.reason}'
                              @mandatory
                              reasonForCancellation: String(2)) returns UpdateResult;
        };

    // =========================================================================
    // Sales Order Item Update
    // =========================================================================

    @requires: 'SalesOrderManage'
    action updateSalesOrderItem(salesOrder: String(10),
                                lineID: String(6),
                                salesPrice: Decimal(15, 3),
                                salesPriceUnit: String(3),
                                specialDealFlagSo: Boolean,
                                hpNotesToCustomer: String(1000),
                                hpBacklogNotes: String(1000)) returns UpdateResult;


    @readonly
    @title   : '{i18n>SalesOrderAcknowledgements}'
    @restrict: [{
        grant: ['READ'],
        to   : [
            'SalesOrderManage',
            'SalesOrderViewer'
        ]
    }]


    // =========================================================================
// Sales Order Header Update
// =========================================================================

@requires: 'SalesOrderManage'
action updateSalesOrderHeader(hpSalesOrder: String(10),
                              hpNotesToCustomer: String(1000)) returns UpdateResult;


                              
    entity SalesOrderAcknowledgements as projection on db.SalesOrderAcknowledgements;

    // ==========================================================================
    // Reporting — UI exports (FDS 3.13 / slide 53)
    // Available read-only to both roles.
    // // ==========================================================================
    // /**
    //  * Flat header + item projection backing the Search UI export.
    //  * Covers the fields carried in the PS4 -> BTP mapping sheet. The legacy
    //  * Collab export additionally expands Ship To / Bill To / Payer / LSP
    //  * addresses and partner contacts into ~168 columns — those are not in the
    //  * mapping sheet and need a Customer Master join if they stay in scope.
    //  */


    @readonly
    @title                 : '{i18n>SalesOrderSearchExport}'
    @cds.redirection.target: false
    @restrict              : [{
        grant: ['READ'],
        to   : [
            'SalesOrderManage',
            'SalesOrderViewer'
        ]
    }]
    entity SalesOrderSearchExport     as
        projection on db.SalesOrderItems {
            key salesOrder.hpSalesOrder                  as hpSalesOrder,
                salesOrder.customerOrder                 as customerOrder,
                salesOrder.soOrderDate                   as soOrderDate,
                salesOrder.wbsProjectCode                as wbsProjectCode,
                salesOrder.wbsProjectCodeDescription     as wbsProjectCodeDescription,
                salesOrder.salesOrderStatus.code         as salesOrderStatus,
                salesOrder.contractNumber                as contractNumber,
                salesOrder.businessModel                 as businessModel,
                salesOrder.hpCompanyCode                 as hpCompanyCode,
                salesOrder.hpCompanyDescription          as hpCompanyDescription,
                salesOrder.customerCode                  as customerCode,
                salesOrder.customerDescription           as customerDescription,
                salesOrder.shipTo                        as shipTo,
                salesOrder.billTo                        as billTo,
                salesOrder.payer                         as payer,
                salesOrder.otherShipTo                   as otherShipTo,
                salesOrder.hpBuyerCode                   as hpBuyerCode,
                salesOrder.hpBuyerName                   as hpBuyerName,
                salesOrder.hpSalesOrganization           as hpSalesOrganization,
                salesOrder.salesOrderOrigin.code         as salesOrderOrigin,
                salesOrder.businessUnit                  as businessUnit,
                salesOrder.paymentTerms                  as paymentTerms,
                salesOrder.hpPlant                       as hpPlant,
                salesOrder.customerNotesToHp             as headerCustomerNotesToHp,
                salesOrder.hpNotesToCustomer             as headerHpNotesToCustomer,
                salesOrder.contractDate                  as contractDate,
                salesOrder.customerOrderDate             as customerOrderDate,
                salesOrder.soRequisitionCreationDateTime as soRequisitionCreationDateTime,
                salesOrder.blanketIndicator              as blanketIndicator,
                salesOrder.lspAddress                    as lspAddress,
                salesOrder.salesOrderType.code           as salesOrderType,

            key lineId,
                hpPartNumber,
                hpPartDescription,
                lineStatus.code                          as lineStatus,
                customerPartNumber,
                quantity,
                quantityUnit,
                plannedReceiptDate,
                salesPrice,
                salesPriceUnit,
                salesPriceCurrency,
                lineAmount,
                lineAmountCurrency,
                fromLine,
                originalPlannedReceiptDate,
                carrierSo,
                otherCarrierSo,
                soChangeInOrigin,
                reasonForCancellation.code               as reasonForCancellation,
                shippingPoint,
                soAckOutOrigin,
                storageLocation,
                endSupplier,
                hpNotesToCustomer,
                customerNotesToHp,
                specialDealFlagSo,
                specialPriceIndicatorSo,
                transitTime,
                customerLineId,
                gtsHold,
                incotermsRevision,
                termsOfDelivery,
                deliveryPlace,
                confirmedLineId,
                confirmedQuantity,
                confirmedReceiptDate,
                totalInvoicedQuantity,
                totalShippedQuantity,
                totalDeliveredQuantity,
                balanceQuantity,
                soRequisitionNumber,
                hpPurchaseOrder,
                hpPoLineItem,
                hpBacklogNotes
        };


    /** Schedule Summary screen — order counts per line status (FDS 3.13) */
    @readonly
    @title                 : '{i18n>SalesOrderScheduleSummary}'
    @cds.redirection.target: false
    @restrict              : [{
        grant: ['READ'],
        to   : [
            'SalesOrderManage',
            'SalesOrderViewer'
        ]
    }]
    entity SalesOrderScheduleSummary  as
        select from db.SalesOrderItems {
            key lineStatus.code     as lineStatus     : String(4) @title: '{i18n>summary.lineStatus}',
                lineStatus.name     as lineStatusName : String    @title: '{i18n>summary.lineStatusName}',
                lineStatus.priority as priority       : Integer   @title: '{i18n>summary.priority}',
                count(1)            as orderCount     : Integer   @title: '{i18n>summary.orderCount}'
        }
        group by
            lineStatus.code,
            lineStatus.name,
            lineStatus.priority;

    // ==========================================================================
    // Value helps — read-only reference data, open to both roles
    // ==========================================================================

    @readonly  @cds.odata.valuelist
    @title   : '{i18n>SalesOrderStatuses}'
    @restrict: [{
        grant: ['READ'],
        to   : [
            'SalesOrderManage',
            'SalesOrderViewer'
        ]
    }]
    entity SalesOrderStatuses         as projection on db.SalesOrderStatuses;

    @readonly  @cds.odata.valuelist
    @title   : '{i18n>LineStatuses}'
    @restrict: [{
        grant: ['READ'],
        to   : [
            'SalesOrderManage',
            'SalesOrderViewer'
        ]
    }]
    entity LineStatuses               as projection on db.LineStatuses;

    @readonly  @cds.odata.valuelist
    @title   : '{i18n>SalesOrderTypes}'
    @restrict: [{
        grant: ['READ'],
        to   : [
            'SalesOrderManage',
            'SalesOrderViewer'
        ]
    }]
    entity SalesOrderTypes            as projection on db.SalesOrderTypes;

    @readonly  @cds.odata.valuelist
    @title   : '{i18n>SalesOrderOrigins}'
    @restrict: [{
        grant: ['READ'],
        to   : [
            'SalesOrderManage',
            'SalesOrderViewer'
        ]
    }]
    entity SalesOrderOrigins          as projection on db.SalesOrderOrigins;

    @readonly  @cds.odata.valuelist
    @title   : '{i18n>CancellationReasons}'
    @restrict: [{
        grant: ['READ'],
        to   : [
            'SalesOrderManage',
            'SalesOrderViewer'
        ]
    }]
    entity CancellationReasons        as projection on db.CancellationReasons;

    // ==========================================================================
    // Action result
    // ==========================================================================

    type UpdateResult     : {
        @title: '{i18n>result.hpSalesOrder}'
        hpSalesOrder    : String(10);

        @title: '{i18n>result.lineId}'
        lineId          : String(6);

        @title: '{i18n>result.status}'
        status          : String(4);

        /** true once the ORDCHG IDoc has been handed to Integration Suite */
        @title: '{i18n>result.ordchgTriggered}'
        ordchgTriggered : Boolean;

        @title: '{i18n>result.message}'
        message         : String;
    };


    //-------------------------------------------------------------------------------*
    // HP BuySell Value Helps - Sales Order
    // FDS Section 6.8 / 7.2
    //-------------------------------------------------------------------------------*

    //===============================================================================*
    // Code-list-backed Value Helps
    //===============================================================================*

    @readonly
    @cds.redirection.target: false
    entity VH_OrderStatus             as
        projection on db.SalesOrderStatuses {
            code,
            priority
        }
        order by
            priority asc;


    @readonly
    @cds.redirection.target: false
    entity VH_LineStatus              as
        projection on db.LineStatuses {
            code,
            priority
        }
        order by
            priority asc;


    // Sales Order Type
    // FDS values: ZBLB, ZCBS, ZICB

    @readonly
    @cds.redirection.target: false
    entity VH_SalesOrderType          as
        projection on db.SalesOrderTypes {
            code
        };


    // Sales Order Origin
    // Values maintained in SalesOrderOrigins CodeList

    @readonly
    @cds.redirection.target: false
    entity VH_SalesOrderOrigin        as
        projection on db.SalesOrderOrigins {
            code
        };


    // Cancellation Reason

    @readonly
    @cds.redirection.target: false
    entity VH_ReasonForCancellation   as
        projection on db.CancellationReasons {
            code
        };


    // Business Model

    @readonly
    @cds.redirection.target: false
    entity VH_BusinessModel           as
        select distinct key businessModel from db.SalesOrders
        where
                businessModel is not null
            and businessModel <>     '';


    //===============================================================================*
    // Sales Order Header Value Helps
    //===============================================================================*

    //-------------------------------------------------------------------------------*
    // HP Sales Order
    // FDS: HP Sales Order - Search Filter
    //-------------------------------------------------------------------------------*

    @cds.redirection.target: false
    entity VH_SalesOrderNumber        as
        select distinct
            key hpSalesOrder,
                customerDescription
        from db.SalesOrders
        where
                hpSalesOrder is not null
            and hpSalesOrder <>     '';


    //-------------------------------------------------------------------------------*
    // Customer Code + Customer Description
    //-------------------------------------------------------------------------------*

    @cds.redirection.target: false
    entity VH_Customer                as
        select distinct
            key customerCode,
                customerDescription
        from db.SalesOrders
        where
                customerCode is not null
            and customerCode <>     '';


    //-------------------------------------------------------------------------------*
    // Customer Order
    //-------------------------------------------------------------------------------*

    @cds.redirection.target: false
    entity VH_CustomerOrder           as
        select distinct key customerOrder from db.SalesOrders
        where
                customerOrder is not null
            and customerOrder <>     '';


    //-------------------------------------------------------------------------------*
    // HP Buyer Code + HP Buyer Name
    //-------------------------------------------------------------------------------*

    @cds.redirection.target: false
    entity VH_Buyer                   as
        select distinct
            key hpBuyerCode,
                hpBuyerName
        from db.SalesOrders
        where
                hpBuyerCode is not null
            and hpBuyerCode <>     '';


    //-------------------------------------------------------------------------------*
    // HP Company Code + HP Company Description
    //-------------------------------------------------------------------------------*

    @cds.redirection.target: false
    entity VH_CompanyCode             as
        select distinct
            key hpCompanyCode,
                hpCompanyDescription
        from db.SalesOrders
        where
                hpCompanyCode is not null
            and hpCompanyCode <>     '';


    //-------------------------------------------------------------------------------*
    // HP Sales Organization
    //-------------------------------------------------------------------------------*

    @cds.redirection.target: false
    entity VH_SalesOrganization       as
        select distinct key hpSalesOrganization from db.SalesOrders
        where
                hpSalesOrganization is not null
            and hpSalesOrganization <>     '';


    //-------------------------------------------------------------------------------*
    // HP Plant
    //-------------------------------------------------------------------------------*

    @cds.redirection.target: false
    entity VH_Plant                   as
        select distinct key hpPlant from db.SalesOrders
        where
                hpPlant is not null
            and hpPlant <>     '';


    //-------------------------------------------------------------------------------*
    // Business Unit
    //-------------------------------------------------------------------------------*

    @cds.redirection.target: false
    entity VH_BusinessUnit            as
        select distinct key businessUnit from db.SalesOrders
        where
                businessUnit is not null
            and businessUnit <>     '';


    //-------------------------------------------------------------------------------*
    // WBS Project Code + Description
    //-------------------------------------------------------------------------------*

    @cds.redirection.target: false
    entity VH_WbsProject              as
        select distinct
            key wbsProjectCode,
                wbsProjectCodeDescription
        from db.SalesOrders
        where
                wbsProjectCode is not null
            and wbsProjectCode <>     '';


    //-------------------------------------------------------------------------------*
    // Ship To
    //-------------------------------------------------------------------------------*

    @cds.redirection.target: false
    entity VH_ShipTo                  as
        select distinct key shipTo from db.SalesOrders
        where
                shipTo is not null
            and shipTo <>     '';


    //-------------------------------------------------------------------------------*
    // Bill To
    //-------------------------------------------------------------------------------*

    @cds.redirection.target: false
    entity VH_BillTo                  as
        select distinct key billTo from db.SalesOrders
        where
                billTo is not null
            and billTo <>     '';


    //-------------------------------------------------------------------------------*
    // Payer
    //-------------------------------------------------------------------------------*

    @cds.redirection.target: false
    entity VH_Payer                   as
        select distinct key payer from db.SalesOrders
        where
                payer is not null
            and payer <>     '';


    //-------------------------------------------------------------------------------*
    // Other Ship To
    //-------------------------------------------------------------------------------*

    @cds.redirection.target: false
    entity VH_OtherShipTo             as
        select distinct key otherShipTo from db.SalesOrders
        where
                otherShipTo is not null
            and otherShipTo <>     '';


    //-------------------------------------------------------------------------------*
    // Payment Terms
    //-------------------------------------------------------------------------------*

    @cds.redirection.target: false
    entity VH_PaymentTerms            as
        select distinct key paymentTerms from db.SalesOrders
        where
                paymentTerms is not null
            and paymentTerms <>     '';


    //===============================================================================*
    // Sales Order Item Value Helps
    //===============================================================================*

    //-------------------------------------------------------------------------------*
    // HP Part Number + HP Part Description
    //-------------------------------------------------------------------------------*

    @cds.redirection.target: false
    entity VH_HpPartNumber            as
        select distinct
            key hpPartNumber,
                hpPartDescription
        from db.SalesOrderItems
        where
                hpPartNumber is not null
            and hpPartNumber <>     '';


    //-------------------------------------------------------------------------------*
    // Customer Part Number
    //-------------------------------------------------------------------------------*

    @cds.redirection.target: false
    entity VH_CustomerPart            as
        select distinct
            key customerPartNumber,
                hpPartNumber,
                hpPartDescription
        from db.SalesOrderItems
        where
                customerPartNumber is not null
            and customerPartNumber <>     '';


    //-------------------------------------------------------------------------------*
    // Storage Location
    //-------------------------------------------------------------------------------*

    @cds.redirection.target: false
    entity VH_StorageLocation         as
        select distinct key storageLocation from db.SalesOrderItems
        where
                storageLocation is not null
            and storageLocation <>     '';


    //-------------------------------------------------------------------------------*
    // End Supplier
    //-------------------------------------------------------------------------------*

    @cds.redirection.target: false
    entity VH_EndSupplier             as
        select distinct key endSupplier from db.SalesOrderItems
        where
                endSupplier is not null
            and endSupplier <>     '';


    //-------------------------------------------------------------------------------*
    // SO Ack Out Origin
    //-------------------------------------------------------------------------------*

    @cds.redirection.target: false
    entity VH_SoAckOutOrigin          as
        select distinct key soAckOutOrigin from db.SalesOrderItems
        where
                soAckOutOrigin is not null
            and soAckOutOrigin <>     '';


    //-------------------------------------------------------------------------------*
    // SO Change In Origin
    //-------------------------------------------------------------------------------*

    @cds.redirection.target: false
    entity VH_SoChangeInOrigin        as
        select distinct key soChangeInOrigin from db.SalesOrderItems
        where
                soChangeInOrigin is not null
            and soChangeInOrigin <>     '';


    //===============================================================================*
    // Static Value Helps
    //===============================================================================*

    //-------------------------------------------------------------------------------*
    // Special Deal Flag (SO)
    // Model type: Boolean
    // FDS: Drop Down - With Values
    //-------------------------------------------------------------------------------*

    @cds.persistence.skip
    @cds.redirection.target: false
    @readonly
    entity VH_SpecialDealFlag {
        key code        : Boolean;
            description : String(60);
    }


    //-------------------------------------------------------------------------------*
    // GTS Hold
    // Model type: Boolean
    // FDS: Search Filter
    //-------------------------------------------------------------------------------*

    @cds.persistence.skip
    @cds.redirection.target: false
    @readonly
    entity VH_GtsHold {
        key code        : Boolean;
            description : String(60);
    }


    //-------------------------------------------------------------------------------*
    // Blanket Indicator
    // Model type: Boolean
    //-------------------------------------------------------------------------------*

    @cds.persistence.skip
    @cds.redirection.target: false
    @readonly
    entity VH_BlanketIndicator {
        key code        : Boolean;
            description : String(60);
    }

}


// ==========================================================================
// Editable-fields metadata — lets the Freestyle UI fetch the whitelist
// instead of hardcoding it (single source of truth in the service impl)
// ==========================================================================

type EditableFieldsResult : {
    entity : String;
    fields : array of String;
};

@requires: 'authenticated-user'
function getEditableFields(entityName: String)                returns array of EditableFieldsResult;

// ==========================================================================
// Current-user role info — backs isHpBuyer in the Freestyle UI.
// Uses req.user.is(<role>), which resolves against the XSUAA/IAS scopes
// mapped to SalesOrderManage / SalesOrderViewer in xs-security.json.
// ==========================================================================

type UserInfoResult       : {
    isHpBuyer : Boolean;
    isViewer  : Boolean;
};

@requires: 'authenticated-user'
function getUserInfo()                                        returns UserInfoResult;
