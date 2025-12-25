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
  try {
    const result = await pool.query<Turbine>(
      'SELECT id, location_name, capacity_mw, lat, lon FROM german_wind_power LIMIT 1000'
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.listen(4000, () => console.log('TS Backend on http://localhost:4000'));