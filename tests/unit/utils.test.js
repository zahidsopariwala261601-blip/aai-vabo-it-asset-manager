const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Load Public/js/utils.js into an isolated VM context
const utilsCode = fs.readFileSync(path.resolve(__dirname, '../../Public/js/utils.js'), 'utf8');
const context = {
    console,
    Date,
    parseInt,
    isNaN,
    Object,
    RegExp,
    String,
    Array,
    Set,
    Math,
    document: null,
    window: { matchMedia: () => ({ matches: false }) }
};
vm.createContext(context);
vm.runInContext(utilsCode, context);

const {
    cleanDesignation,
    validateAssetRecord,
    isValidIPv4,
    parseCSV,
    ALLOWED_DESIGNATIONS,
    DESIGNATION_MAPPING
} = context;

describe('Unit Tests: Frontend Utilities (utils.js)', () => {

    describe('cleanDesignation()', () => {
        it('returns empty string for null, undefined, or empty values', () => {
            assert.equal(cleanDesignation(null), '');
            assert.equal(cleanDesignation(undefined), '');
            assert.equal(cleanDesignation(''), '');
            assert.equal(cleanDesignation('   '), '');
        });

        it('maps exact designations correctly', () => {
            assert.equal(cleanDesignation('EXECUTIVE DIRECTOR'), 'ED');
            assert.equal(cleanDesignation('ED'), 'ED');
            assert.equal(cleanDesignation('GENERAL MANAGER'), 'GM');
            assert.equal(cleanDesignation('GM'), 'GM');
            assert.equal(cleanDesignation('JOINT GENERAL MANAGER'), 'JGM');
            assert.equal(cleanDesignation('JT. GENERAL MANAGER'), 'JGM');
            assert.equal(cleanDesignation('JGM'), 'JGM');
            assert.equal(cleanDesignation('JT. GM'), 'JGM');
            assert.equal(cleanDesignation('DEPUTY GENERAL MANAGER'), 'DGM');
            assert.equal(cleanDesignation('DGM'), 'DGM');
            assert.equal(cleanDesignation('ASSISTANT GENERAL MANAGER'), 'AGM');
            assert.equal(cleanDesignation('AGM'), 'AGM');
            assert.equal(cleanDesignation('SR. MANAGER'), 'SM');
            assert.equal(cleanDesignation('SM'), 'SM');
            assert.equal(cleanDesignation('MANAGER'), 'MGR');
            assert.equal(cleanDesignation('MGR'), 'MGR');
            assert.equal(cleanDesignation('ASSISTANT MANAGER'), 'AM');
            assert.equal(cleanDesignation('AM'), 'AM');
            assert.equal(cleanDesignation('JUNIOR EXECUTIVE'), 'JE');
            assert.equal(cleanDesignation('JE'), 'JE');
        });

        it('normalizes common misspellings and abbreviations', () => {
            assert.equal(cleanDesignation('MANEGAR'), 'MGR');
            assert.equal(cleanDesignation('COMPUTER OPEARTOR'), 'COMPUTER OPERATOR');
            assert.equal(cleanDesignation('COMP.OP'), 'COMPUTER OPERATOR');
            assert.equal(cleanDesignation('APPRENTISE'), 'APPRENTICE');
        });

        it('handles case insensitivity and whitespace', () => {
            assert.equal(cleanDesignation('  manegar  '), 'MGR');
            assert.equal(cleanDesignation('general manager'), 'GM');
            assert.equal(cleanDesignation('dgm'), 'DGM');
            assert.equal(cleanDesignation('  je '), 'JE');
        });

        it('fuzzy maps strings containing standard designation keywords based on mapping order', () => {
            assert.equal(cleanDesignation('SUPERVISOR (ELECTRICAL)'), 'SUPERVISOR');
            assert.equal(cleanDesignation('SR. SUPERINTENDENT (CIVIL)'), 'SR. SUPERINTENDENT');
            assert.equal(cleanDesignation('APPRENTISE (TECH)'), 'APPRENTICE');
        });

        it('retains uppercase original for unknown designations', () => {
            assert.equal(cleanDesignation('Chief Pilot'), 'CHIEF PILOT');
            assert.equal(cleanDesignation('UNKNOWN_ROLE'), 'UNKNOWN_ROLE');
        });
    });

    describe('isValidIPv4()', () => {
        it('accepts valid standard IPv4 addresses', () => {
            assert.equal(isValidIPv4('192.168.1.1'), true);
            assert.equal(isValidIPv4('10.0.0.1'), true);
            assert.equal(isValidIPv4('172.16.254.1'), true);
            assert.equal(isValidIPv4('127.0.0.1'), true);
        });

        it('accepts boundary IPv4 octets (0 and 255)', () => {
            assert.equal(isValidIPv4('0.0.0.0'), true);
            assert.equal(isValidIPv4('255.255.255.255'), true);
            assert.equal(isValidIPv4('192.168.0.255'), true);
        });

        it('rejects out-of-range octets (> 255)', () => {
            assert.equal(isValidIPv4('256.1.1.1'), false);
            assert.equal(isValidIPv4('192.168.1.300'), false);
            assert.equal(isValidIPv4('192.168.999.1'), false);
        });

        it('rejects malformed IP formats', () => {
            assert.equal(isValidIPv4('192.168.1'), false);
            assert.equal(isValidIPv4('192.168.1.1.1'), false);
            assert.equal(isValidIPv4('192.168.1.a'), false);
            assert.equal(isValidIPv4(''), false);
            assert.equal(isValidIPv4('not-an-ip'), false);
            assert.equal(isValidIPv4('192.168.1.-1'), false);
            assert.equal(isValidIPv4('...'), false);
        });
    });

    describe('validateAssetRecord()', () => {
        it('validates a completely compliant asset record', () => {
            const validRow = {
                name: 'Desktop PC',
                serial_number: 'SN-VABO-001',
                current_user: 'Rajesh Kumar',
                assigned_desig: 'Manager',
                year_of_purchase: 2022
            };
            const result = validateAssetRecord(validRow);
            assert.equal(result.isValid, true);
            assert.equal(result.errors.length, 0);
            assert.equal(result.cleanedDesig, 'MGR');
        });

        it('flags missing mandatory fields (name, serial_number, current_user)', () => {
            const missingRow = {
                name: '',
                serial_number: '',
                current_user: ''
            };
            const result = validateAssetRecord(missingRow);
            assert.equal(result.isValid, false);
            assert.ok(result.errors.includes('Missing Asset Type/Name'));
            assert.ok(result.errors.includes('Missing Serial Number'));
            assert.ok(result.errors.includes('Missing Holder Name'));
        });

        it('flags placeholder name "Unknown" as missing asset type', () => {
            const row = {
                name: 'Unknown',
                serial_number: 'SN-1234',
                current_user: 'IT Store'
            };
            const result = validateAssetRecord(row);
            assert.equal(result.isValid, false);
            assert.ok(result.errors.includes('Missing Asset Type/Name'));
        });

        it('validates purchase year within 2000 to current year', () => {
            const curYear = new Date().getFullYear();
            assert.equal(validateAssetRecord({
                name: 'Laptop', serial_number: 'SN1', current_user: 'IT Store', year_of_purchase: 2000
            }).isValid, true);

            assert.equal(validateAssetRecord({
                name: 'Laptop', serial_number: 'SN1', current_user: 'IT Store', year_of_purchase: curYear
            }).isValid, true);

            const pastResult = validateAssetRecord({
                name: 'Laptop', serial_number: 'SN1', current_user: 'IT Store', year_of_purchase: 1998
            });
            assert.equal(pastResult.isValid, false);
            assert.ok(pastResult.errors[0].includes('Invalid Year: 1998'));

            const futureResult = validateAssetRecord({
                name: 'Laptop', serial_number: 'SN1', current_user: 'IT Store', year_of_purchase: curYear + 5
            });
            assert.equal(futureResult.isValid, false);
            assert.ok(futureResult.errors[0].includes(`Invalid Year: ${curYear + 5}`));
        });

        it('flags invalid designation when cleaned designation is not in ALLOWED_DESIGNATIONS', () => {
            const row = {
                name: 'Printer',
                serial_number: 'PRN-999',
                current_user: 'Amit Shah',
                assigned_desig: 'Space Astronaut'
            };
            const result = validateAssetRecord(row);
            assert.equal(result.isValid, false);
            assert.ok(result.errors.some(e => e.includes('Invalid Designation: SPACE ASTRONAUT')));
        });
    });

    describe('parseCSV()', () => {
        it('returns empty array for empty input or header-only CSV', () => {
            assert.equal(parseCSV('').length, 0);
            assert.equal(parseCSV('ID,Asset Type,Serial\n').length, 0);
        });

        it('parses standard comma-delimited rows matching standard fields', () => {
            const csv = `ID,Asset Type,Serial,Current Holder,Department,Designation,Year of Purchase
1,Laptop,SN-LAP-001,Rajesh Patel,IT / CNS,Manager,2023`;
            const rows = parseCSV(csv);
            assert.equal(rows.length, 1);
            assert.equal(rows[0].name, 'Laptop');
            assert.equal(rows[0].serial_number, 'SN-LAP-001');
            assert.equal(rows[0].current_user, 'Rajesh Patel');
            assert.equal(rows[0].assigned_dept, 'IT / CNS');
            assert.equal(rows[0].assigned_desig, 'MGR'); // cleaned
            assert.equal(rows[0].year_of_purchase, '2023');
            assert.equal(rows[0]._isValid, true);
        });

        it('correctly handles quoted fields containing commas', () => {
            const csv = `ID,Asset Type,Serial,Current Holder,Department
1,"PC, High Performance","SN-COMMAS,001","Sharma, Vikram",CNS`;
            const rows = parseCSV(csv);
            assert.equal(rows.length, 1);
            assert.equal(rows[0].name, 'PC, High Performance');
            assert.equal(rows[0].serial_number, 'SN-COMMAS,001');
            assert.equal(rows[0].current_user, 'Sharma, Vikram');
        });

        it('preserves empty fields between commas', () => {
            const csv = `ID,Asset Type,Serial,Charger Serial,Current Holder
1,Laptop,SN-002,,IT Store`;
            const rows = parseCSV(csv);
            assert.equal(rows.length, 1);
            assert.equal(rows[0].charger_serial, '');
            assert.equal(rows[0].current_user, 'IT Store');
        });

        it('strips UTF-8 BOM if present on first header line', () => {
            const csv = `\uFEFFID,Asset Type,Serial,Current Holder
1,Monitor,SN-MON-99,IT Store`;
            const rows = parseCSV(csv);
            assert.equal(rows.length, 1);
            assert.equal(rows[0].name, 'Monitor');
            assert.equal(rows[0].serial_number, 'SN-MON-99');
        });

        it('handles CRLF line endings cleanly', () => {
            const csv = "ID,Asset Type,Serial,Current Holder\r\n1,UPS,SN-UPS-1,IT Store\r\n2,Printer,SN-PRN-1,IT Store\r\n";
            const rows = parseCSV(csv);
            assert.equal(rows.length, 2);
            assert.equal(rows[0].name, 'UPS');
            assert.equal(rows[1].name, 'Printer');
        });
    });
});
