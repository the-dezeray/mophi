import * as satellite from 'satellite.js';

let satrecs = [];

self.onmessage = function(e) {
    const { type } = e.data;

    if (type === 'init') {
        const { data } = e.data;
        const rawData = data;
        let failCount = 0;
        satrecs = rawData.map(item => {
            try {
                const rec = createSatRec(item);
                if (!rec) failCount++;
                return rec;
            } catch (err) {
                failCount++;
                // console.warn('Failed to create satrec for', item[0], err);
                return null;
            }
        }).filter(s => s !== null);
        
        console.log(`Worker: Created ${satrecs.length} satrecs from ${rawData.length} items. Failed: ${failCount}`);
        self.postMessage({ type: 'ready', count: satrecs.length });
    } else if (type === 'update') {
        const { date } = e.data;
        const dateObj = new Date(date);
        const positions = new Float32Array(satrecs.length * 3);
        
        // Get GMST for coordinate conversion
        const gmst = satellite.gstime(dateObj);

        for (let i = 0; i < satrecs.length; i++) {
            const satrec = satrecs[i];
            // Propagate
            const positionAndVelocity = satellite.propagate(satrec, dateObj);
            const positionEci = positionAndVelocity.position;
            
            if (positionEci && typeof positionEci.x === 'number') {
                // Convert ECI to ECF (Earth Centered Fixed) to match rotating earth
                const positionEcf = satellite.eciToEcf(positionEci, gmst);
                
                positions[i * 3] = positionEcf.x;
                positions[i * 3 + 1] = positionEcf.y;
                positions[i * 3 + 2] = positionEcf.z;
            } else {
                positions[i * 3] = 0;
                positions[i * 3 + 1] = 0;
                positions[i * 3 + 2] = 0;
            }
        }
        
        // Transfer buffer to main thread
        self.postMessage({ type: 'update', positions }, [positions.buffer]);
    }
};

function createSatRec(data) {
    // data: [id, name, epoch_unix, incl, raan, ecc, argp, ma, mm, bstar]
    const [id, name, epochUnix, incl, raan, ecc, argp, ma, mm, bstar] = data;

    // Helper to format float
    const f = (n, w, d) => n.toFixed(d).padStart(w, ' ');
    // Helper to format int
    const i = (n, w) => String(n).padStart(w, '0');
    
    // Epoch conversion
    const date = new Date(epochUnix * 1000);
    const yearFull = date.getUTCFullYear();
    const year = yearFull % 100;
    const startOfYear = new Date(Date.UTC(yearFull, 0, 0));
    const diff = date - startOfYear;
    const oneDay = 1000 * 60 * 60 * 24;
    const dayOfYear = diff / oneDay;
    
    // Format Line 1
    const line1Body = `1 ${i(id, 5)}U 00000A   ${i(year, 2)}${f(dayOfYear, 12, 8)}  .00000000  00000-0  ${formatBstar(bstar)} 0  999`;
    const line1 = line1Body + computeChecksum(line1Body);

    // Format Line 2
    const eccStr = f(ecc, 9, 7).replace('0.', '').substring(0, 7);
    const line2Body = `2 ${i(id, 5)} ${f(incl, 8, 4)} ${f(raan, 8, 4)} ${eccStr} ${f(argp, 8, 4)} ${f(ma, 8, 4)} ${f(mm, 11, 8)}00001`;
    const line2 = line2Body + computeChecksum(line2Body);

    return satellite.twoline2satrec(line1, line2);
}

function formatBstar(bstar) {
    return "00000-0"; 
}

function computeChecksum(line) {
    let sum = 0;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char >= '0' && char <= '9') {
            sum += parseInt(char, 10);
        } else if (char === '-') {
            sum += 1;
        }
    }
    return sum % 10;
}
