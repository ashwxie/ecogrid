import { useEffect, useRef } from 'react';
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

interface Turbine {
  id: number;
  location_name: string;
  lat: number | string;
  lon: number | string;
  capacity_mw: string;
}

function App() {
  const mapElement = useRef<HTMLDivElement>(null);
  const popupElement = useRef<HTMLDivElement>(null);
  const popupContent = useRef<HTMLDivElement>(null);

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
        return new Style({
          image: new Circle({
            radius: size > 1 ? 14: 7,
            fill: new Fill({ color: size > 1 ? '#2e7d32' : '#66bb6a'}),
            stroke: new Stroke({ color: '#fff', width: 2}),
          }),
          text: size > 1 ? new Text({
            text: size.toString(),
            fill: new Fill({ color: '#fff'}),
          }) : undefined,
        });
      },
    });

    const map = new Map({
      target: mapElement.current,
      layers: [
        new TileLayer({ source: new OSM() }),
        clusters,
      ],
      view: new View({ center: fromLonLat([10.4515, 51.1657]), zoom: 6 }),
    });

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

    fetch('http://localhost:4000/api/turbines')
      .then(res => res.json())
      .then(data => {
        const features = data.map((t: Turbine) => {
          const lon = typeof t.lon === 'string' ? parseFloat(t.lon) : t.lon;
          const lat = typeof t.lat === 'string' ? parseFloat(t.lat) : t.lat;
          if (!isNaN(lon) && !isNaN(lat)) {
            const feature = new Feature({
              geometry: new Point(fromLonLat([lon, lat])),
            });
            feature.setProperties({
              location_name: t.location_name,
              capacity_mw: t.capacity_mw
            });
          return feature;
        }
        return null;
      }).filter((f:any) => f != null);  
      vectorSource.addFeatures(features);
    });
    return () => map.setTarget(undefined);
  }, []);

  return (
  <div ref={mapElement} style={{ width: '100%', height: '100vh', position: 'relative' }}>
    <div 
      ref={popupElement} 
      style={{ 
        position: 'absolute', 
        background: 'white', 
        padding: '10px', 
        borderRadius: '8px', 
        boxShadow: '0 2px 10px rgba(0,0,0,0.2)', 
        display: 'none', 
        minWidth: '200px',
        transform: 'translate(-50%, -100%)',
        marginTop: '-10px'
      }}
    >
      <div ref={popupContent} />
    </div>
  </div>);
}

export default App;