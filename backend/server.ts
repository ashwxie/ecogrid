import express from 'express';
import { Pool } from 'pg';
import cors from 'cors';

const app = express();
app.use(cors());

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'postgres',
  password: 'banana',
  port: 5433,
});

interface Turbine {
  id: number;
  location_name: string;
  lat: number;
  lon: number;
  capacity_mw: number;
}

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

app.get('/api/turbines', async (req, res) => {
  const { minLon, minLat, maxLon, maxLat } = req.query;

  try {
    const result = await pool.query<Turbine>(`
      SELECT id, location_name, capacity_mw, ST_X(geon) as lon, ST_Y(geom) as lat
      FROM german_wind_power
      WHERE geom && ST_MakeEnvelope($1, $2, $3, $4, 4326)
      LIMIT 1000;
    `, [minLon, minLat, maxLon, maxLat]);

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "SQL Spatial Query Failed"});
  }
});

app.get('/api/turbines/bbox', async (req, res) => {
  console.log('Query received:', req.query);

  const minLon = parseFloat(req.query.minLon as string);
  const minLat = parseFloat(req.query.minLat as string);
  const maxLon = parseFloat(req.query.maxLon as string);
  const maxLat = parseFloat(req.query.maxLat as string);

  if ([minLon, minLat, maxLon, maxLat].some(isNaN)) {
    return res.status(400).json({ error: "Invalid coordinates" });
  }

  try {
    const result = await pool.query(`
      SELECT id, location_name, capacity_mw, ST_X(geom) as lon, ST_Y(geom) as lat
      FROM german_wind_power
      WHERE geom && ST_MakeEnvelope($1, $2, $3, $4, 4326)
      LIMIT 1000;
    `, [minLon, minLat, maxLon, maxLat]); // Corrected typo here
    
    res.json(result.rows);
  } catch (e: any) {
    console.error("Database Error:", e.message); 
    console.error("ERROR CODE:", e.code);
    res.status(500).json({ error: "Server Error", details: e.message });
  }
});

app.get('/api/turbines/nearest', async (req, res) => {
  const { lon, lat } = req.query;  

  try {
    const result = await pool.query(`
      SELECT id, location_name, capacity_mw,
      ST_Distance(geom, ST_SetSRID(ST_Point($1, $2), 4326)) as distance_deg
      FROM german_wind_power
      ORDER BY geom <-> ST_SetSRID(ST_Point($1, $2), 4326)
      LIMIT 3;
      `, [lon, lat]);
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: "SQL Spatial search failed"});
  }
});



app.listen(4000, () => console.log('TS Backend on http://localhost:4000'));