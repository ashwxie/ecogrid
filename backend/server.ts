import express, { Request, Response } from 'express';
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

app.get('/api/turbines', async (req: Request, res: Response) => {
  const { minLon, minLat, maxLon, maxLat } = req.query;

  try {
    const result = await pool.query<Turbine>(
      `SELECT id, location_name, capacity_mw, ST_X(geon) as lon, ST_Y(geom) as lat
      FROM german_wind_power
      WHERE geom && ST_MakeEnvelope($1, $2, $3, $4, 4321)
      LIMIT 1000;
    `, [minLon, minLat, maxLon, maxLat]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "SQL Spatial Query Failed"});
  }
});

app.listen(4000, () => console.log('TS Backend on http://localhost:4000'));