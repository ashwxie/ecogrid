import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
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
import { fromLonLat, toLonLat } from 'ol/proj';
import { Circle, Fill, Stroke, Style, Text  } from 'ol/style';
import { calculateHouseholds } from './utils';

interface Turbine {
  id: number;
  location_name: string;
  lat: number | string;
  lon: number | string;
  capacity_mw: string;
}
const API_BASE_URL = 'http://localhost:4000/api'

function App() {
  const mapElement = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<Map | null>(null);
  const popupElement = useRef<HTMLDivElement>(null);
  const popupContent = useRef<HTMLDivElement>(null);
  const vectorSourceRef = useRef<VectorSource>(new VectorSource());
  
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

  const fetchInBBox = useCallback(() => {
    const map = mapInstance.current;
    if (!map) return;
    
    setLoading(true);
    const extent = map.getView().calculateExtent(map.getSize());
    const bottomLeft = toLonLat([extent[0], extent[1]]);
    const topRight = toLonLat([extent[2], extent[3]]);

    fetch(`${API_BASE_URL}/turbines/bbox?minLon=${bottomLeft[0]}&minLat=${bottomLeft[1]}&maxLon=${topRight[0]}&maxLat=${topRight[1]}`)
      .then(res => {
        if (!res.ok) throw new Error('BBox API Error');
        return res.json();
      }).then(data => {
        setTurbines(data);
        vectorSourceRef.current.clear();
        const features = data.map((t: Turbine) => {
          const f = new Feature({ 
            geometry: new Point(fromLonLat([Number(t.lon), Number(t.lat)])) 
          });
          f.setProperties(t);
          return f;
        });
        vectorSourceRef.current.addFeatures(features);
        setLoading(false);
        setError(null);
      }).catch(err => {
        setError("Could not load regional data.");
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!mapElement.current || !popupElement.current || !popupContent.current) return;
    const clusterSource = new Cluster({
      distance: 40,
      source: vectorSourceRef.current,
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

    map.on('click', (evt) => {
      const feature = map.forEachFeatureAtPixel(evt.pixel, (feat) => feat);
      if (feature && feature.get('features')) {
        const clusterFeatures = feature.get('features');
        if (clusterFeatures.length === 1) {
          const data = clusterFeatures[0].getProperties();
          const capacity = parseFloat(data.capacity_mw) || 0;
          const households = calculateHouseholds(capacity) // Household Calculation: $Capacity \times 2000 / 3.5$
          if (popupContent.current && popupElement.current) {
          popupContent.current.innerHTML = `
            <div style="font-family: Arial, sans-serif; padding: 5px; font-size: 13px;">  
              <strong style="color: #2e7d32;">${data.location_name || 'Unknown Turbine'}</strong><br />
              <hr style="border: 0; border-top: 1px solid #eee; margin: 5px 0;">
              Capacity: <b>${capacity} MW</b><br />
              Powers: <b>~${households.toLocaleString()} homes/y</b>
            </div>`;
          popupElement.current.style.display = 'block';
          overlay.setPosition(evt.coordinate);
          }
        }
      } else {
        if (popupElement.current) popupElement.current.style.display = 'none';
      }
    });
map.getViewport().addEventListener('contextmenu', (evt) => {
      evt.preventDefault();
      const coords = map.getEventCoordinate(evt);
      const [lon, lat] = toLonLat(coords);

      fetch(`${API_BASE_URL}/turbines/nearest?lon=${lon}&lat=${lat}`)
        .then(res => res.json())
        .then(data => {
          if (data.length > 0) {
            alert(`Nearest: ${data[0].location_name} at ${data[0].capacity_mw} MW`);
          }
        });
    });

    // Performance Optimization: Fetch on Move
    map.on('moveend', fetchInBBox);

    // Change cursor on hover
    map.on('pointermove', (e) => {
      const pixel = map.getEventPixel(e.originalEvent);
      map.getTargetElement().style.cursor = map.hasFeatureAtPixel(pixel) ? 'pointer' : '';
    });

    // Initial Fetch
    fetchInBBox();

    return () => map.setTarget(undefined);
  }, [fetchInBBox]);

  const flyTo = (lon: number, lat: number) => {
    mapInstance.current?.getView().animate({
      center: fromLonLat([lon, lat]),
      zoom: 13,
      duration: 1000
    });
  };
return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      
      {/* Sidebar Section */}
      <aside style={{ width: '350px', backgroundColor: '#fff', borderRight: '1px solid #ddd', display: 'flex', flexDirection: 'column', zIndex: 10 }}>
        <div style={{ padding: '20px', backgroundColor: '#fdfdfd' }}>
          <h2 style={{ color: '#2e7d32', margin: 0 }}>🌿 EcoGrid DE</h2>
          <p style={{ fontSize: '12px', color: '#666' }}>High-Performance Spatial Dashboard</p>
        </div>

        <div style={{ padding: '0 20px 20px' }}>
          {error && <div style={{ color: 'red', fontSize: '12px' }}>⚠️ {error}</div>}
          
          <div style={{ background: '#f0f4f0', padding: '15px', borderRadius: '10px', marginBottom: '15px' }}>
            <span style={{ fontSize: '11px', color: '#444' }}>REGIONAL CAPACITY</span>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#2e7d32' }}>
              {totalMW.toFixed(1)} MW
            </div>
            <span style={{ fontSize: '12px' }}>{calculateHouseholds(totalMW).toLocaleString()} Households</span>
          </div>

          <input 
            type="text" 
            placeholder="Search visible location..." 
            style={{ width: '100%', padding: '10px', borderRadius: '5px', border: '1px solid #ddd', boxSizing: 'border-box' }}
            onChange={(e) => setTerm(e.target.value)}
          />
        </div>

        {/* Scrollable Turbine List */}
        <div style={{ flex: 1, overflowY: 'auto', borderTop: '1px solid #eee' }}>
          {loading && <p style={{ padding: '20px', fontSize: '13px' }}>🛰️ Syncing grid data...</p>}
          {filteredTurbines.slice(0, 50).map(t => (
            <div 
              key={t.id} 
              onClick={() => flyTo(Number(t.lon), Number(t.lat))}
              style={{ padding: '12px 20px', borderBottom: '1px solid #f9f9f9', cursor: 'pointer', transition: 'background 0.2s' }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f5f5f5')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <div style={{ fontSize: '13px', fontWeight: 'bold' }}>{t.location_name}</div>
              <div style={{ fontSize: '11px', color: '#888' }}>{t.capacity_mw} MW</div>
            </div>
          ))}
        </div>
      </aside>

      {/* Map Section */}
      <main ref={mapElement} style={{ flex: 1, position: 'relative' }}>
        <div 
          ref={popupElement} 
          style={{ 
            position: 'absolute', 
            background: 'white', 
            padding: '12px', 
            borderRadius: '8px', 
            boxShadow: '0 4px 15px rgba(0,0,0,0.15)', 
            display: 'none', 
            minWidth: '180px',
            transform: 'translate(-50%, -100%)',
            marginTop: '-15px'
          }}
        >
          <div ref={popupContent} />
          {/* Arrow pointing down */}
          <div style={{ position: 'absolute', left: '50%', bottom: '-8px', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '8px solid transparent', borderRight: '8px solid transparent', borderTop: '8px solid white' }} />
        </div>
      </main>
    </div>
  );
}

export default App;