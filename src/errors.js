import { derive } from './utils';

var dexieErrorNames = [
    'Modify',
    'Bulk',
    'OpenFailed',
    'VersionChange',
    'Schema',
    'Upgrade',
    'InvalidTable',
    'MissingAPI',
    'NoSuchDatabase',
    'InvalidArgument',
    'SubTransaction',
    'Unsupported',
    'Internal',
    'DatabaseClosed',
    'IncompatiblePromise'
];

var idbDomErrorNames = [
    'Unknown',
    'Constraint',
    'Data',
    'TransactionInactive',
    'ReadOnly',
    'Version',
    'NotFound',
    'InvalidState',
    'InvalidAccess',
    'Abort',
    'Timeout',
    'QuotaExceeded',
    'Syntax',
    'DataClone'
];

var errorList = dexieErrorNames.concat(idbDomErrorNames);

var defaultTexts = {
    VersionChanged: "Database version changed by other database connection",
    DatabaseClosed: "Database has been closed",
    IncompatiblePromise: "Incompatible Promise used in transaction scope. See http://tinyurl.com/znyqjqc",
    Abort: "Transaction aborted",
    TransactionInactive: "Transaction has already completed or failed"
};

//
// DexieError - base class of all out exceptions.
//
export function DexieError (name, msg) {
    // Reason we don't use ES6 classes is because:
    // 1. It bloats transpiled code and increases size of minified code.
    // 2. It doesn't give us much in this case.
    // 3. It would require sub classes to call super(), which
    //    is not needed when deriving from Error.
    this.name = name;
    this.message = msg;
}
derive(DexieError).from(Error);

function getMultiErrorMessage (msg, failures) {
    return msg + ". Errors: " + failures
        .map(f=>f.toString())
        .filter((v,i,s)=>s.indexOf(v)===i) // Only unique error strings
        .join('\n');
}

//
// ModifyError - thrown in WriteableCollection.modify()
// Specific constructor because it contains members failures and failedKeys.
//
export function ModifyError (msg, failures, successCount, failedKeys) {
    this.name = "ModifyError";
    this.failures = failures;
    this.failedKeys = failedKeys;
    this.successCount = successCount;
    this.message = getMultiErrorMessage(msg, failures);
}
derive(ModifyError).from(DexieError);

export function BulkError (msg, failures) {
    this.name = "BulkError";
    this.failures = failures;
    this.message = getMultiErrorMessage(msg, failures);
}
derive(BulkError).from(DexieError);

//
//
// Dynamically generate error names and exception classes based
// on the names in errorList.
//
//

// Map of {ErrorName -> ErrorName + "Error"}
export var errnames = errorList.reduce((obj,name)=>(obj[name]=name+"Error",obj),{});

// Need an alias for DexieError because we're gonna create subclasses with the same name.
const BaseException = DexieError;
// Map of {ErrorName -> exception constructor}
export var exceptions = errorList.reduce((obj,name)=>{
    // Let the name be "DexieError" because this name may
    // be shown in call stack and when debugging. DexieError is
    // the most true name because it derives from DexieError,
    // and we cannot change Function.name programatically without
    // dynamically create a Function object, which would be considered
    // 'eval-evil'.
    var fullName = name + "Error";
    function DexieError (msgOrInner, inner){
        this.name = fullName;
        if (!msgOrInner) {
            this.message = defaultTexts[name] || fullName;
            this.inner = null;
        } else if (typeof msgOrInner === 'string') {
            this.message = msgOrInner;
            this.inner = inner || null;
        } else if (typeof msgOrInner === 'object') {
            this.message = `${msgOrInner.name} ${msgOrInner.message}`;
            this.inner = msgOrInner;
        }
    }
    derive(DexieError).from(BaseException);
    obj[name]=DexieError;
    return obj;
},{});

// Use ECMASCRIPT standard exceptions where applicable:
exceptions.Syntax = SyntaxError;
exceptions.Type = TypeError;
exceptions.Range = RangeError;

export var exceptionMap = idbDomErrorNames.reduce((obj, name)=>{
    obj[name + "Error"] = exceptions[name];
    return obj;
}, {});

export function mapError (domError, message) {
    var rv = domError;
    if (!(domError instanceof DexieError) && domError.name && exceptionMap[domError.name]) {
        rv = new exceptionMap[domError.name](message || domError.message, domError);
    }
    return rv;
}

export var fullNameExceptions = errorList.reduce((obj, name)=>{
    if (["Syntax","Type","Range"].indexOf(name) === -1)
        obj[name + "Error"] = exceptions[name];
    return obj;
}, {});

fullNameExceptions.ModifyError = ModifyError;
fullNameExceptions.DexieError = DexieError;
fullNameExceptions.BulkError = BulkError;
