"use strict";

const cds = require("@sap/cds");
const { SELECT } = cds.ql;

const MDM_SERVICE_NAME = "hpbuysell_mdm_common_srv_dest";

const LOG = cds.log("sales-order-mdm-value-help");

const MDM_VALUE_HELP_CONFIG = {
  VH_Buyer: {
    entity: "BuyerVH",
    columns: ["buyercode", "buyername"],
    outputMap: {
      buyercode: "hpBuyerCode",
      buyername: "hpBuyerName"
    }
  },

  VH_BusinessModel: {
    entity: "BusinessModelVH",
    columns: ["businessmodel", "businessmodeldescription"],
    outputMap: {
      businessmodel: "businessModel",
      businessmodeldescription: "businessModelDescription"
    }
  },

  VH_CompanyCode: {
    entity: "CompanyCode",
    columns: ["companycode", "companycodedescription"],
    outputMap: {
      companycode: "hpCompanyCode",
      companycodedescription: "hpCompanyDescription"
    }
  },

  VH_WbsProject: {
    entity: "ProjectVH",
    columns: ["wbselement", "wbsdescription"],
    outputMap: {
      wbselement: "wbsProjectCode",
      wbsdescription: "wbsProjectCodeDescription"
    }
  },

  VH_HpPartNumber: {
    entity: "MaterialVH",
    columns: ["materialnumber", "materialdescription"],
    outputMap: {
      materialnumber: "hpPartNumber",
      materialdescription: "hpPartDescription"
    }
  },

  VH_Plant: {
    entity: "PlantVH",
    columns: ["plant", "plantname"],
    outputMap: {
      plant: "hpPlant",
      plantname: "hpPlantDescription"
    }
  },

  VH_StorageLocation: {
    entity: "StorageLocationVH",
    columns: [
      "storagelocation",
      "plant",
      "storagelocationname"
    ],
    outputMap: {
      storagelocation: "storageLocation",
      storagelocationname: "storageLocationDescription"
    }
  }
};


function getMdmService() {
  return cds.connect.to(MDM_SERVICE_NAME);
}


/**
 * Convert incoming local/SO field names to MDM field names.
 *
 * Example:
 * hpBuyerCode eq 'H052'
 *        ↓
 * buyercode eq 'H052'
 */
function translateWhere(where, config) {
  if (!where) {
    return undefined;
  }

  const result = JSON.parse(JSON.stringify(where));

  function walk(node) {
    if (!Array.isArray(node)) {
      return node;
    }

    return node.map((part) => {
      if (
        typeof part === "string" &&
        config.fieldMap &&
        config.fieldMap[part]
      ) {
        return config.fieldMap[part];
      }

      if (Array.isArray(part)) {
        return walk(part);
      }

      return part;
    });
  }

  return walk(result);
}


/**
 * Remove UI-specific query options that MDM does not support.
 *
 * Especially:
 *   SELECT DISTINCT
 *   $apply
 *   $count
 *   pagination generated for local VH
 */
function buildMdmQuery(req, config) {
  const incoming = req.query?.SELECT;

  const columns = config.columns.map((column) => ({
    ref: [column]
  }));

  const query = SELECT.from(config.entity)
    .columns(columns);

  if (incoming?.where) {
    const translatedWhere = translateWhere(
      incoming.where,
      config
    );

    if (translatedWhere?.length) {
      query.where(translatedWhere);
    }
  }

  return query;
}


/**
 * Remove duplicate MDM rows in Node instead of
 * sending SELECT DISTINCT to remote MDM.
 */
function removeDuplicates(rows, columns) {
  const seen = new Set();

  return rows.filter((row) => {
    const key = columns
      .map((column) => String(row[column] ?? ""))
      .join("|");

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}


async function readMdmValueHelp(
  req,
  valueHelpName,
  additionalWhere
) {

  const config = MDM_VALUE_HELP_CONFIG[valueHelpName];

  if (!config) {
    req.reject(
      404,
      `Unsupported MDM value help: ${valueHelpName}`
    );
  }

  const mdm = await getMdmService();

  const query = buildMdmQuery(req, config);

  if (additionalWhere && additionalWhere.length) {

    if (query.SELECT.where && query.SELECT.where.length) {

      query.SELECT.where = [
        "(",
        ...query.SELECT.where,
        ")",
        "and",
        ...additionalWhere
      ];

    } else {

      query.SELECT.where = additionalWhere;
    }
  }

  LOG.info(
    `[MDM VH] ${valueHelpName} -> ${config.entity}`
  );

  const rows = await mdm.run(query);

  LOG.info(
    `[MDM VH] ${valueHelpName}: ${rows.length} rows received`
  );

  const uniqueRows = removeDuplicates(
    rows,
    config.columns
  );

  return uniqueRows.map((row) => {
    const result = {};

    for (const [mdmField, localField] of Object.entries(
      config.outputMap
    )) {
      result[localField] = row[mdmField];
    }

    return result;
  });
}


function isMdmValueHelp(valueHelpName) {
  return !!MDM_VALUE_HELP_CONFIG[valueHelpName];
}


module.exports = {
  MDM_SERVICE_NAME,
  MDM_VALUE_HELP_CONFIG,
  isMdmValueHelp,
  readMdmValueHelp
};