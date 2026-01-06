import { useEffect, useMemo, useRef, useState } from 'react';
import 'ol/ol.css';
import Feature from 'ol/Feature';
import Map from 'ol/Map';
import Overlay from 'ol/Overlay';
import View from 'ol/View';
import Point from 'ol/geom/Point';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import Cluster from 'ol/source/Cluster';
import OSM from 'ol/source/OSM';
import VectorSource from 'ol/source/Vector';
import { fromLonLat } from 'ol/proj';
import { Circle, Fill, Stroke, Style, Text  } from 'ol/style';
import { calculateHouseholds } from './utils';

interface Turbine {
  id: number;
  location_name: string;
  lat: number | string;
  lon: number | string;
  capacity_mw: string;
}

function App() {
  const mapElement = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<Map | null>(null);
  const popupElement = useRef<HTMLDivElement>(null);
  const popupContent = useRef<HTMLDivElement>(null);

  const [turbines, setTurbines] = useState<Turbine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [term, setTerm] = useState('');

  const filteredTurbines = useMemo(() => {
    return turbines.filter(t => 
      t.location_name?.toLowerCase().includes(term?.toLowerCase()));
  }, [turbines, term]);

  const totalMW = useMemo(() => 
    filteredTurbines.reduce((sum, t) => sum + (parseFloat(t.capacity_mw) || 0), 0)
  , [filteredTurbines]);

  useEffect(() => {
    if (!mapElement.current || !popupElement.current || !popupContent.current) return;
    const vectorSource = new VectorSource();
    const clusterSource = new Cluster({
      distance: 40,
      source: vectorSource,
    });
    const clusters = new VectorLayer({
      source: clusterSource,
      style: (feature) => {
        const size = feature.get('features').length;
        const zoom = mapInstance.current?.getView().getZoom() || 0;
        if (size === 1 || zoom > 10) {
          return new Style({
            image: new Circle({
              radius: 6,
              fill: new Fill({ color: '#66bb6a'}),
              stroke: new Stroke({ color: '#fff', width: 2}),
            }),
          });
        }
        return new Style({
          image: new Circle({
            radius: 14,
            fill: new Fill({ color: '#2e7d32' }),
            stroke: new Stroke({ color: '#fff', width: 2}),
          }),
          text: new Text({
            text: size.toString(),
            fill: new Fill({ color: '#fff'}),
          }),
        });
      },
    });

    const map = new Map({
      target: mapElement.current,
      layers: [ new TileLayer({ source: new OSM() }), clusters, ],
      view: new View({ center: fromLonLat([10.4515, 51.1657]), zoom: 6 }),
    });
    mapInstance.current = map;

    const overlay = new Overlay({ element: popupElement.current, autoPan: true });
    map.addOverlay(overlay);

    map.on('click', (e) => {
      const feature = map.forEachFeatureAtPixel(e.pixel, (feat) => feat);
      if (feature && feature.get('features')) {
        const clusterFeatures = feature.get('features');
        if (clusterFeatures.length === 1) {
          const data = clusterFeatures[0].getProperties();
          const capacity = parseFloat(data.capacity_mw) || 0;
          const households = Math.round((capacity * 2000) / 3.5); // Household Calculation: $Capacity \times 2000 / 3.5$
          if (popupContent.current && popupElement.current) {
          popupContent.current.innerHTML = `
            <div style="font-family: Arial, sans-serif; padding: 5px; font-size: 13px;">  
              <strong style="color: #2e7d32;">${data.location_name || 'Unknown Turbine'}</strong><br />
              <hr style="border: 0; border-top: 1px solid #eee; margin: 5px 0;">
              Capacity: <b>${capacity} MW</b><br />
              Powers: <b>~${households.toLocaleString()} homes/y</b>
            </div>`;
          popupElement.current.style.display = 'block';
          overlay.setPosition(e.coordinate);
          }
        }
      } else {
        if (popupElement.current) popupElement.current.style.display = 'none';
      }
    });

    setLoading(true);
    fetch('http://localhost:4000/api/turbines')
      .then(res => {
        if(!res.ok) throw new Error('Failed to connect to ecogrid API');
        return res.json();
      }).then(data => {
        setTurbines(data);
        const features = data.map((t: Turbine) => {
          const lon = typeof t.lon === 'string' ? parseFloat(t.lon) : t.lon;
          const lat = typeof t.lat === 'string' ? parseFloat(t.lat) : t.lat;
            const feature = new Feature({
              geometry: new Point(fromLonLat([lon, lat])),
            });
            feature.setProperties({
              location_name: t.location_name,
              capacity_mw: t.capacity_mw
            });
          return feature;        
      });
      vectorSource.addFeatures(features);
      setLoading(false);
    }).catch(e => {
      setError(e.message);
      setLoading(false);
    });
    return () => map.setTarget(undefined);
  }, []);

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', fontFamily: 'Arial' }}>
      
      {/* --- SIDEBAR --- */}
      <div style={{ width: '350px', background: '#f8f9fa', padding: '20px', borderRight: '1px solid #ddd', display: 'flex', flexDirection: 'column' }}>
        <h2 style={{ color: '#2e7d32', margin: '0 0 20px 0' }}>🌿 EcoGrid DE</h2>
        
        {loading && <div className="loader">🛰️ Fetching Grid Data...</div>}
        {error && <div style={{ color: 'red', padding: '10px', background: '#fee' }}>⚠️ {error}</div>}

        {!loading && !error && (
          <>
            <div style={{ marginBottom: '20px', padding: '15px', background: '#fff', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
              <p style={{ margin: '0', fontSize: '12px', color: '#666' }}>TOTAL CAPACITY</p>
              <h1 style={{ margin: '5px 0', color: '#2e7d32' }}>{totalMW.toFixed(1)} <span style={{ fontSize: '18px' }}>MW</span></h1>
              <p style={{ margin: '0', fontSize: '12px' }}>🔋 Powers ~{((totalMW * 2000) / 3.5).toLocaleString()} households</p>
            </div>

            <input 
              type="text" 
              placeholder="Search by location..." 
              style={{ padding: '10px', borderRadius: '4px', border: '1px solid #ccc', marginBottom: '10px' }}
              onChange={(e) => setTerm(e.target.value)}
            />
            
            <div style={{ flex: 1, overflowY: 'auto', fontSize: '13px' }}>
              <p>{filteredTurbines.length} Turbines found</p>
              {filteredTurbines.slice(0, 100).map(t => (
                <div key={t.id} style={{ padding: '8px 0', borderBottom: '1px solid #eee' }}>
                  <b>{t.location_name}</b> ({t.capacity_mw} MW)
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* --- MAP --- */}
      <div ref={mapElement} style={{ flex: 1, position: 'relative' }}>
        <div ref={popupElement} className="ol-popup" style={{ /* ... existing popup styles ... */ }}>
          <div ref={popupContent} />
        </div>
      </div>
    </div>
  );
}

export default App;