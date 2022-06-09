// Importing the dependencies 
const express = require("express"); 
const cors = require("cors"); 
const morgan = require("morgan"); 
const mysql = require("mysql-await");
const fs = require("fs");

// Init MySQL connection
var connection;

function reconnect() {
  if (connection) {
    connection.destroy();
  }
  connection = mysql.createConnection(JSON.parse(fs.readFileSync("mysql-config.json")));
  connection.connect((err) => {
    if (err) {
      console.error(`Connect to MySQL Failed, err = ${err.code}! retry in 2s.`);
      setTimeout(reconnect, 2000);
    } else {
      console.log("Connect to MySQL success!");
    }
  });
}
reconnect();

connection.on("error", (err) => {
  console.error(`MySQL Connection error ${err.code}`);
  reconnect();
});

// Defining the Express app 
const app = express(); 
const PORT = process.env.PORT || 3000;
  
// Calling the express.json() method for parsing
app.use(express.json()); 
  
// Enabling CORS for all requests 
var corsOptionsDelegate = function (req, callback) {
  var corsOptions = {
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 204
  };
  corsOptions.origin = req.get('Origin'); 
  callback(null, corsOptions) // callback expects two parameters: error and options
}
app.use(cors(corsOptionsDelegate)); 
  
// Adding morgan to log HTTP requests 
app.use(morgan("combined")); 

//------------------------------------------------------------------------//

// Common
function handleSQLError(err, res) {
    switch(err.code) {
      case "ER_NO_SUCH_TABLE":
        console.error(err.sqlMessage);
        res.status(404).json({
          status: err.errno,
          msg: err.sqlMessage
        });
        break;
      
      default:
        console.error(err);
        res.status(500).json({
          status: err.errno,
          msg: err.sqlMessage
        });
        break;
    }
}

function handleGenerateSQLError(err_msg, req, res) {
    res.status(400).json({
        status: 400,
        msg: err_msg,
        req: req.body
    });
}

function initOkJson(result) {
  return {
    status: 0,
    msg: result.message,
    affected: result.affectedRows,
    changed: result.changedRows
  }
}

function generateWhereClause(condition_group) {
  if (!("conjunction" in condition_group && "children" in condition_group)) {
    return "";
  }
  let conjunction = condition_group.conjunction.toUpperCase();
  if (conjunction != "AND" && conjunction != "OR") {
    return "";
  }

  let clause = "";
  let first_condition = true;
  condition_group.children.forEach(condition => {
    if (!first_condition) {
      clause += ` ${conjunction} `;
    } else {
      first_condition = false;
    }

    if ("op" in condition && "left" in condition) {
      if (!("type" in condition.left && "field" in condition.left && condition.left.type == "field")) {
        return "";
      }

      // Check
      switch(condition.op) {
        case "between":
        case "not_between":
          if (!Array.isArray(condition.right) || condition.right.length != 2) {
            return "";
          }
          break;

        case "select_any_in":
        case "select_not_any_in":
          if (!Array.isArray(condition.right)) {
            return "";
          }
          break;

        case "is_empty":
        case "is_not_empty":
          break;

        default:
          if (!("right" in condition && !Array.isArray(condition.right))) {
            return "";
          }
          break;
      }

      switch(condition.op) {
        case "equal":
        case "select_equals":
          clause += `(${condition.left.field} = "${condition.right}")`;
          break;

        case "not_equal":
        case "select_not_equals":
          clause += `(${condition.left.field} != "${condition.right}")`;
          break;

        case "less":
          clause += `(${condition.left.field} < "${condition.right}")`;
          break;

        case "less_or_equal":
          clause += `(${condition.left.field} <= "${condition.right}")`;
          break;

        case "greater":
          clause += `(${condition.left.field} > "${condition.right}")`;
          break;

        case "greater_or_equal":
          clause += `(${condition.left.field} >= "${condition.right}")`;
          break;

        case "between":
          clause += `(${condition.left.field} BETWEEN "${condition.right[0]}" and "${condition.right[1]}")`;
          break;

        case "not_between":
          clause += `(${condition.left.field} NOT BETWEEN "${condition.right[0]}" and "${condition.right[1]}")`;
          break;

        case "is_empty":
          clause += `(${condition.left.field} IS NULL)`;
          break;

        case "is_not_empty":
          clause += `(${condition.left.field} IS NOT NULL)`;
          break;

        case "like":
          clause += `(${condition.left.field} LIKE "${condition.right}")`;
          break;

        case "not_like":
          clause += `(${condition.left.field} NOT LIKE "${condition.right}")`;
          break;

        case "starts_with":
          clause += `(${condition.left.field} LIKE "${condition.right}%")`;
          break;

        case "ends_with":
          clause += `(${condition.left.field} LIKE "%${condition.right}")`;
          break;
        
        case "select_not_any_in":
          let not_any_flag = true;
        case "select_any_in":
          if (not_any_flag) {
            clause += `(${condition.left.field} NOT IN (`;
          } else {
            clause += `(${condition.left.field} IN (`;
          }
          let first_any_value = true;
          condition.right.forEach(v => {
            if (!first_any_value) {
              clause += ",";
            } else {
              first_any_value = false;
            }
            clause += `"${v}"`;
          });
          if (first_any_value) {
            return "";
          }
          clause += "))";
          break;

        default:
          console.log(`Invalid condition op ${condition.op}`);
          return "";
      }
    } else if ("conjunction" in condition) {
      let sub_clause = generateWhereClause(condition);
      if (sub_clause === "")
        return "";
      clause += `(${sub_clause})`;
    } else {
      return "";
    }
  });
  return clause;
} 

// Create & Update
function generateInsertSQL(req) {
  let req_json = req.body;
  if (!("values" in req_json)) {
    return ["", "Do not contains 'values' field!"];
  }  
  let sql = `INSERT INTO ${req.params.table} SET `;

  let first_col = true;
  req_json.values.forEach(col => {
    if (!("column" in col && "value" in col)) {
      return ["", "Do not contains 'column' or 'value' field!"];
    }
    if (!first_col) {
      sql += ',';
    } else {
      first_col = false;
    }
    sql += `${col.column}="${col.value}"`;
  });
  if (first_col) {
    return ["", "'values' field is empty"];
  }

  console.log(`Generate SQL: ${sql}`);
  return [sql, ""];
}

function generateUpdateSQL(req) {
  let req_json = req.body;
  if (!("values" in req_json)) {
    return ["", "Do not contains 'values' field!"];
  }  
  let sql = `UPDATE ${req.params.table} SET `;

  let first_col = true;
  req_json.values.forEach(col => {
    if (!("column" in col && "value" in col)) {
      return ["", "Do not contains 'column' or 'value' field!"];
    }
    if (!first_col) {
      sql += ',';
    } else {
      first_col = false;
    }
    sql += `${col.column}="${col.value}"`;
  });
  if (first_col) {
    return ["", "'values' field is empty"];
  }

  if (req_json.conditions) {
    let where_clause = generateWhereClause(req_json.conditions);

    if (where_clause === "") {
      return ["", "Where conditions error"];
    }
    sql += ` WHERE (${where_clause})`;
  }

  console.log(`Generate SQL: ${sql}`);
  return [sql, ""];
}

app.post("/:table", async (req, res) => {
  let sql, err_msg;
  if (req.query.type === "create") {
    [sql, err_msg] = generateInsertSQL(req);
  } else if (req.query.type === "update") {
    [sql, err_msg] = generateUpdateSQL(req);
  } else {
    return handleGenerateSQLError("req type invalid!", req, res);
  }
  if (!sql || sql === "") {
    return handleGenerateSQLError(err_msg, req, res);
  }

  try {
    let result = await connection.awaitQuery(sql);
    console.log(result);
    res.status(200).json(initOkJson(result));
  } catch (err) {
    handleSQLError(err, res);
  }
});

// Delete
function generateDeleteSQL(req) {
  let req_json = req.body;
  let sql = `DELETE FROM ${req.params.table}`;

  if (req_json.conditions) {
    let where_clause = generateWhereClause(req_json.conditions);

    if (where_clause === "") {
      return ["", "Where conditions error"];
    }
    sql += ` WHERE (${where_clause})`;
  } else {
    // Do not allow delete whole table!
    console.warn("Do not allow delete whole table!");
    return ["", "Do not allow delete whole table!"];
  }

  console.log(`Generate SQL: ${sql}`);
  return [sql, ""];
}

app.delete("/:table", async (req, res) => { 
  let [sql, err_msg] = generateDeleteSQL(req);
  if (!sql || sql === "") {
    return handleGenerateSQLError(err_msg, req, res);
  }

  try {
    let result = await connection.awaitQuery(sql);
    console.log(result);
    res.status(200).json(initOkJson(result));
  } catch (err) {
    handleSQLError(err, res);
  }
});

// Select
function generateSelectSQL(req) {
  let req_json = req.body;
  let sql = `SELECT `;
  if (Array.isArray(req_json.columns)) {
    let first_col = true;
    req_json.columns.forEach(col => {
      if (!first_col) {
        sql += ',';
      } else {
        first_col = false;
      }
      sql += `${col}`;
    });
    if (first_col) {
      return ["", "Has columns but empty!"];
    }
  } else {
    sql += '*';
  }  
  sql += ` FROM ${req.params.table}`;

  if (req_json.conditions) {
    let where_clause = generateWhereClause(req_json.conditions);

    if (where_clause === "") {
      return ["", "Where conditions error"];
    }
    sql += ` WHERE (${where_clause})`;
  } 
  console.log(`Generate SQL: ${sql}`);
  return [sql, ""];
}

// Simple Query
app.get("/:table", async (req, res) => {
  let sql = `SELECT * from ${req.params.table}`;
  let condition = "";
  for (const [col, val] of Object.entries(req.query)) {
    if (condition === "") {
      condition += `${col}="${val}"`
    } else {
      condition += ` AND ${col}="${val}"`
    }
  }
  if (condition !== "") {
    sql += ` WHERE ${condition};`;
  } else {
    sql += ';';
  }
  console.log(`Generate SQL: ${sql}`);

  try {
    let result = await connection.awaitQuery(sql);
    // console.log(result);
    console.log(`Simple query result length: ${result.length}`)
    j = {
      status: 0,
      msg: "Success",
      data: {
        items: [],
        total: result.length
      }
    };
    result.forEach(row => {
      j.data.items.push(row);
    })

    res.status(200).json(j);
  } catch (err) {
    handleSQLError(err, res);
  }
});

// Complex Query
app.put("/:table", async (req, res) => { 
  let [sql, err_msg] = generateSelectSQL(req);
  if (!sql || sql === "") {
    return handleGenerateSQLError(err_msg, req, res);
  }

  try {
    let result = await connection.awaitQuery(sql);
    // console.log(result);
    console.log(`Complex query result length: ${result.length}`)
    j = {
      status: 0,
      msg: "Success",
      data: {
        items: [],
        total: result.length
      }
    };
    result.forEach(row => {
      j.data.items.push(row);
    })

    res.status(200).json(j);
  } catch (err) {
    handleSQLError(err, res);
  }
});

//------------------------------------------------------------------------//
  
// starting the server 
app.listen(PORT, (err) => { 
  if (err)
    console.log(err);
  console.log("Server listening on port", PORT);
}); 
