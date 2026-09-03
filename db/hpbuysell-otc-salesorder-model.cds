/**
 * HP Buy-Sell — Sales Order domain model
 * Source: SO mapping file - working.xlsx, sheet "SAP PS4 to SAP BTP"
 *   i18n key   <- BTP - Field Label   (text lives in _i18n/i18n.properties)
 *   CDS type   <- DATA TYPE IN PS4
 *
 * All user-facing text is externalized. Add translations as
 * _i18n/i18n_<locale>.properties (e.g. i18n_de.properties).
 * Deviations from the mapping sheet are flagged with "DEVIATION:".
 */

namespace hpbuysell.otc.salesorder;

using { cuid, managed, sap.common.CodeList } from '@sap/cds/common';

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

@title      : '{i18n>SalesOrders}'
@description: '{i18n>SalesOrders.descr}'

entity SalesOrders : managed {

      @title       : '{i18n>soHeader.hpSalesOrder}'                       // CHAR10
  key hpSalesOrder                  : String(10);

      @title       : '{i18n>soHeader.customerOrder}'                      // CHAR20
      @Common.FieldControl : #ReadOnly   // editable in Phase 2 (FDS 3.7.2)
      customerOrder                 : String(20);

      @title       : '{i18n>soHeader.customerOrderDate}'                  // DATS8
      customerOrderDate             : Date;

      @title       : '{i18n>soHeader.soOrderDate}'                        // DATS8
      soOrderDate                   : Date;

      @title       : '{i18n>soHeader.soRequisitionCreationDateTime}'      // TIMESTAMP
      soRequisitionCreationDateTime : Timestamp;

      @title       : '{i18n>soHeader.salesOrderStatus}'                   // CHAR1
      @readonly    // derived in BTP from line statuses by priority (FDS 3.7.6)
      salesOrderStatus              : Association to SalesOrderStatuses;

      @title       : '{i18n>soHeader.salesOrderType}'                     // CHAR4
      salesOrderType                : Association to SalesOrderTypes;

      @title       : '{i18n>soHeader.salesOrderOrigin}'                   // CHAR10
      salesOrderOrigin              : Association to SalesOrderOrigins;

      @title       : '{i18n>soHeader.businessModel}'                      // CHAR10
      businessModel                 : String(10);

      @title       : '{i18n>soHeader.businessUnit}'                       // CHAR40
      businessUnit                  : String(40);

      @title       : '{i18n>soHeader.blanketIndicator}'                   // CHAR1
      // IDoc E1EDP35 QUALZ='ZBL', CUSADD='X'  ->  true
      blanketIndicator              : Boolean default false;

      @title       : '{i18n>soHeader.contractNumber}'                     // CHAR10
      contractNumber                : String(10);

      @title       : '{i18n>soHeader.contractDate}'                       // DAT8
      // DEVIATION: sheet says "DAT8"; read as DATS8 (SAP date) — confirm with PS4 team
      contractDate                  : Date;

      @title       : '{i18n>soHeader.wbsProjectCode}'                     // CHAR24
      wbsProjectCode                : String(24);

      @title       : '{i18n>soHeader.wbsProjectCodeDescription}'          // CHAR40
      wbsProjectCodeDescription     : String(40);

      @title       : '{i18n>soHeader.hpCompanyCode}'                      // CHAR4
      hpCompanyCode                 : String(4);

      @title       : '{i18n>soHeader.hpCompanyDescription}'               // CHAR25
      // sheet label reads "HP Company Desciption" (typo) — corrected in the bundle
      hpCompanyDescription          : String(25);

      @title       : '{i18n>soHeader.hpSalesOrganization}'                // CHAR4
      hpSalesOrganization           : String(4);

      @title       : '{i18n>soHeader.hpPlant}'                            // CHAR4
      hpPlant                       : String(4);

      @title       : '{i18n>soHeader.hpBuyerCode}'                        // CHAR10
      @Common.FieldControl : #ReadOnly   // editable in Phase 2 (FDS 3.7.2)
      hpBuyerCode                   : String(10);

      @title       : '{i18n>soHeader.hpBuyerName}'                        // CHAR35
      hpBuyerName                   : String(35);

      @title       : '{i18n>soHeader.customerCode}'                       // CHAR10
      customerCode                  : String(10);

      @title       : '{i18n>soHeader.customerDescription}'                // CHAR25
      customerDescription           : String(25);

      @title       : '{i18n>soHeader.shipTo}'                             // CHAR45
      @Common.FieldControl : #ReadOnly   // editable in Phase 2 (FDS 3.7.2)
      shipTo                        : String(45);

      @title       : '{i18n>soHeader.otherShipTo}'                        // CHAR10
      // must be blank when shipTo is filled (FDS 6.9)
      @Common.FieldControl : #ReadOnly   // editable in Phase 2 (FDS 3.7.2)
      otherShipTo                   : String(10);

      @title       : '{i18n>soHeader.billTo}'                             // CHAR45
      billTo                        : String(45);

      @title       : '{i18n>soHeader.payer}'                              // CHAR45
      payer                         : String(45);

      @title       : '{i18n>soHeader.paymentTerms}'                       // CHAR50
      @Common.FieldControl : #ReadOnly   // editable in Phase 2 (FDS 3.7.2)
      paymentTerms                  : String(50);

      @title       : '{i18n>soHeader.lspAddress}'                         // CHAR80
      lspAddress                    : String(80);

      @title       : '{i18n>soHeader.customerNotesToHp}'                  // CHAR255
      @Common.FieldControl : #ReadOnly   // editable in Phase 2 (FDS 3.7.2)
      customerNotesToHp             : String(255);

      @title       : '{i18n>soHeader.hpNotesToCustomer}'                  // CHAR255
      // MVP-editable by HP Buyer (FDS 3.7.2)
      hpNotesToCustomer             : String(255);

      // Not in the mapping sheet, required by FDS 3.10 / slide 35
      @title       : '{i18n>soHeader.simpleChangeProcessingInd}'          // CHAR1
      @readonly
      simpleChangeProcessingInd     : Boolean default false;

      // SO Acknowledgement (PDF) — sheet type "STRING / ATTACHMENT"
      @title       : '{i18n>soHeader.acknowledgements}'
      acknowledgements              : Composition of many SalesOrderAcknowledgements
                                        on acknowledgements.salesOrder = $self;

      @title       : '{i18n>soHeader.items}'
      items                         : Composition of many SalesOrderItems
                                        on items.salesOrder = $self;
}

// ---------------------------------------------------------------------------
// Item
// ---------------------------------------------------------------------------

@title      : '{i18n>SalesOrderItems}'
@description: '{i18n>SalesOrderItems.descr}'
entity SalesOrderItems : managed {

      @title     : '{i18n>soItem.salesOrder}'
  key salesOrder                  : Association to SalesOrders;

      @title     : '{i18n>soItem.lineId}'                                 // NUMC6
      // NUMC kept as String to preserve leading zeros (e.g. '000010')
  key lineId                      : String(6);

      @title     : '{i18n>soItem.fromLine}'                               // NUMC6
      fromLine                    : String(6);

      @title     : '{i18n>soItem.customerLineId}'                         // CHAR10
      customerLineId              : String(10);

      @title     : '{i18n>soItem.lineStatus}'                             // CHAR1
      // sheet calls this "Request Status"; FDS UI name is "Line Status"
      @readonly
      lineStatus                  : Association to LineStatuses;

      @title     : '{i18n>soItem.hpPartNumber}'                           // CHAR40
      hpPartNumber                : String(40);

      @title     : '{i18n>soItem.hpPartDescription}'                      // CHAR40
      hpPartDescription           : String(40);

      @title     : '{i18n>soItem.customerPartNumber}'                     // CHAR35
      @Common.FieldControl : #ReadOnly   // editable in Phase 2 (FDS 3.7.2)
      customerPartNumber          : String(35);

      @title     : '{i18n>soItem.quantity}'                               // QUAN15
      // DEVIATION: sheet shows no decimals; aligned to 3 decimals like all
      // other quantity fields so PS4 QUAN values round-trip without loss
      @Common.FieldControl : #ReadOnly   // editable in Phase 2 (FDS 3.7.2)
      quantity                    : Decimal(15, 3);

      @title     : '{i18n>soItem.quantityUnit}'                           // UNIT3
      quantityUnit                : String(3);

      @title     : '{i18n>soItem.balanceQuantity}'                        // QUAN13,3
      @readonly
      balanceQuantity             : Decimal(13, 3);

      @title     : '{i18n>soItem.totalShippedQuantity}'                   // QUAN13,3
      @readonly
      totalShippedQuantity        : Decimal(13, 3);

      @title     : '{i18n>soItem.totalInvoicedQuantity}'                  // QUAN13,3
      @readonly
      totalInvoicedQuantity       : Decimal(13, 3);

      // Not in the mapping sheet, required by FDS 3.7.1 / 3.11(d)
      @title     : '{i18n>soItem.totalDeliveredQuantity}'
      @readonly
      totalDeliveredQuantity      : Decimal(13, 3);

      @title     : '{i18n>soItem.confirmedLineId}'                        // NUMC6
      @readonly
      confirmedLineId             : String(6);

      @title     : '{i18n>soItem.confirmedQuantity}'                      // QUAN13,3
      @readonly
      confirmedQuantity           : Decimal(13, 3);

      @title     : '{i18n>soItem.confirmedReceiptDate}'                   // DATS10
      @readonly
      confirmedReceiptDate        : Date;

      @title     : '{i18n>soItem.plannedReceiptDate}'                     // DATS10
      @Common.FieldControl : #ReadOnly   // editable in Phase 2 (FDS 3.7.2)
      plannedReceiptDate          : Date;

      @title     : '{i18n>soItem.originalPlannedReceiptDate}'             // DATS10
      @readonly
      originalPlannedReceiptDate  : Date;

      @title     : '{i18n>soItem.salesPrice}'                             // CHAR11
      // DEVIATION: modelled as Decimal, not String. A price held as CHAR
      // cannot support the repricing / comparison logic in FDS 3.10.
      // MVP-editable by HP Buyer (FDS 3.7.2)
      salesPrice                  : Decimal(15, 3);

      @title     : '{i18n>soItem.salesPriceUnit}'                         // DEC5
      // mandatory whenever salesPrice is changed — enforced in srv handler
      // MVP-editable by HP Buyer (FDS 3.7.2)
      salesPriceUnit              : Decimal(5, 0);

      @title     : '{i18n>soItem.salesPriceCurrency}'                     // CUKY5
      salesPriceCurrency          : String(5);

      @title     : '{i18n>soItem.lineAmount}'                             // CURR15
      @readonly
      lineAmount                  : Decimal(15, 2);

      @title     : '{i18n>soItem.lineAmountCurrency}'                     // CUKY5
      lineAmountCurrency          : String(5);

      @title     : '{i18n>soItem.specialDealFlagSo}'                      // CHAR1
      // MVP-editable by HP Buyer (FDS 3.7.2)
      specialDealFlagSo           : Boolean default false;

      // Not in the mapping sheet, required by FDS 3.10
      @title     : '{i18n>soItem.specialPriceIndicatorSo}'
      @readonly
      specialPriceIndicatorSo     : Boolean default false;

      @title     : '{i18n>soItem.specialPriceIndicatorPo}'
      @readonly   // carried from SO Req, not displayed in the SO UI
      specialPriceIndicatorPo     : String(4);

      @title     : '{i18n>soItem.reasonForCancellation}'                  // CHAR2
      // MVP-editable by HP Buyer (FDS 3.7.2)
      reasonForCancellation       : Association to CancellationReasons;

      @title     : '{i18n>soItem.carrierSo}'                              // CHAR10
      @Common.FieldControl : #ReadOnly   // editable in Phase 2 (FDS 3.7.2)
      carrierSo                   : String(10);

      @title     : '{i18n>soItem.otherCarrierSo}'                         // CHAR10
      @Common.FieldControl : #ReadOnly   // editable in Phase 2 (FDS 3.7.2)
      otherCarrierSo              : String(10);

      @title     : '{i18n>soItem.shippingPoint}'                          // CHAR4
      shippingPoint               : String(4);

      @title     : '{i18n>soItem.storageLocation}'                        // CHAR40
      storageLocation             : String(40);

      @title     : '{i18n>soItem.termsOfDelivery}'                        // CHAR50
      @Common.FieldControl : #ReadOnly   // editable in Phase 2 (FDS 3.7.2)
      termsOfDelivery             : String(50);

      @title     : '{i18n>soItem.deliveryPlace}'                          // CHAR25
      @Common.FieldControl : #ReadOnly   // editable in Phase 2 (FDS 3.7.2)
      deliveryPlace               : String(25);

      @title     : '{i18n>soItem.incotermsRevision}'                      // CHAR10
      incotermsRevision           : String(10);

      @title     : '{i18n>soItem.transitTime}'                            // NUMC3
      transitTime                 : String(3);

      @title     : '{i18n>soItem.endSupplier}'                            // CHAR10
      endSupplier                 : String(10);

      @title     : '{i18n>soItem.gtsHold}'                                // CHAR1
      @readonly
      gtsHold                     : Boolean default false;

      @title     : '{i18n>soItem.hpPurchaseOrder}'                        // CHAR10
      @readonly
      hpPurchaseOrder             : String(10);

      @title     : '{i18n>soItem.hpPoLineItem}'                           // NUMC5
      @readonly
      hpPoLineItem                : String(5);

      @title     : '{i18n>soItem.soRequisitionNumber}'                    // CHAR10
      @readonly
      soRequisitionNumber         : String(10);

      @title     : '{i18n>soItem.soAckOutOrigin}'                         // CHAR10
      @readonly
      soAckOutOrigin              : String(10);

      @title     : '{i18n>soItem.soChangeInOrigin}'                       // CHAR10
      @readonly
      soChangeInOrigin            : String(10);

      @title     : '{i18n>soItem.customerNotesToHp}'                      // CHAR255
      @Common.FieldControl : #ReadOnly   // editable in Phase 2 (FDS 3.7.2)
      customerNotesToHp           : String(255);

      @title     : '{i18n>soItem.hpNotesToCustomer}'                      // CHAR255
      // MVP-editable by HP Buyer (FDS 3.7.2)
      hpNotesToCustomer           : String(255);

      @title     : '{i18n>soItem.hpBacklogNotes}'                         // CHAR255
      // DEVIATION: LargeString, not String(255). FDS 3.10(b) requires "as many
      // characters as possible"; field is BTP-only and never sent to PS4.
      // MVP-editable by HP Buyer, visible to HP roles only (FDS 3.10)
      hpBacklogNotes              : LargeString;

      // Not in the mapping sheet, required by FDS 3.10 / slide 40
      @title     : '{i18n>soItem.simpleChangeProcessingInd}'
      @readonly
      simpleChangeProcessingInd   : Boolean default false;
}

// ---------------------------------------------------------------------------
// SO Acknowledgement (PDF) — sheet type "STRING / ATTACHMENT"
// Versioned: FDS 3.9.1 requires original + revised confirmations to be retained
// ---------------------------------------------------------------------------

@title      : '{i18n>SalesOrderAcknowledgements}'
@description: '{i18n>SalesOrderAcknowledgements.descr}'
entity SalesOrderAcknowledgements : cuid, managed {

  @title     : '{i18n>soAck.salesOrder}'
  salesOrder : Association to SalesOrders;

  @title     : '{i18n>soAck.content}'
  @Core.MediaType   : mediaType
  content    : LargeBinary;

  @title     : '{i18n>soAck.mediaType}'
  @Core.IsMediaType : true
  mediaType  : String(100) default 'application/pdf';

  @title     : '{i18n>soAck.fileName}'
  fileName   : String(255);

  @title     : '{i18n>soAck.version}'
  version    : Integer;

  @title     : '{i18n>soAck.isLatest}'
  isLatest   : Boolean default true;

  @title     : '{i18n>soAck.ackType}'
  ackType    : String(20);   // 'CONFIRMATION' | 'CANCELLATION'

  @title     : '{i18n>soAck.receivedAt}'
  receivedAt : Timestamp;
}

// ---------------------------------------------------------------------------
// Code lists
//
// Element labels come from i18n.properties (below).
// The *values* (name / descr per code) are localized data, not bundle keys —
// they live in db/data/*_texts.csv, one row per locale.
// ---------------------------------------------------------------------------

// FDS 3.7.6 — priority drives the derived header status
// DEVIATION: sheet says CHAR1, but there are 11 states and both status fields
// are BTP-calculated (never sent on the wire), so a readable key is used.
@title      : '{i18n>SalesOrderStatuses}'
entity SalesOrderStatuses : CodeList {
      @title     : '{i18n>codeList.code}'
  key code     : String(4);

      @title     : '{i18n>codeList.priority}'
      priority : Integer;
}

@title      : '{i18n>LineStatuses}'
entity LineStatuses : CodeList {
      @title     : '{i18n>codeList.code}'
  key code     : String(4);

      @title     : '{i18n>codeList.priority}'
      priority : Integer;
}

@title      : '{i18n>SalesOrderTypes}'
entity SalesOrderTypes : CodeList {
      @title     : '{i18n>codeList.code}'
  key code : String(4);   // ZBLB, ZCBS, ZICB
}

@title      : '{i18n>SalesOrderOrigins}'
entity SalesOrderOrigins : CodeList {
      @title     : '{i18n>codeList.code}'
  key code : String(10);  // Manual Customer / Manual HP / Mass Upload / EDI
}

// FDS slide 39
@title      : '{i18n>CancellationReasons}'
entity CancellationReasons : CodeList {
      @title     : '{i18n>codeList.code}'
  key code : String(2);   // ZG, ZH, ZI, ZJ
}
