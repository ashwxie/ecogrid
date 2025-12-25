import React, { useEffect, useRef } from 'react';
import 'ol/ol.css';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import { fromLonLat } from 'ol/proj';
import { Style, Circle, Fill } from 'ol/style';

interface Turbine {
  id: number;
  location_name: string;
  lat: number | string;
  lon: number | string;
}

function App() {
  const mapElement = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!mapElement.current) return;
    const vectorSource = new VectorSource();
    const map = new Map({
      target: mapElement.current,
      layers: [
        new TileLayer({ source: new OSM() }),
        new VectorLayer({
          source: vectorSource,
          style: new Style({
            image: new Circle({ radius: 5, fill: new Fill({ color: 'green' }) }),
          }),
        }),
      ],
      view: new View({ center: fromLonLat([10.4515, 51.1657]), zoom: 6 }),
    });

    fetch('http://localhost:4000/api/turbines')
      .then(res => res.json())
      .then(data => {
        data.forEach((t: Turbine) => {
          const lon = typeof t.lon === 'string' ? parseFloat(t.lon) : t.lon;
          const lat = typeof t.lat === 'string' ? parseFloat(t.lat) : t.lat;
          if (!isNaN(lon) && !isNaN(lat)) {
              const feature = new Feature({
                geometry: new Point(fromLonLat([lon, lat])),
              });
              vectorSource.addFeature(feature);
            }
        });
      });

    return () => map.setTarget(undefined);
  }, []);

  return <div ref={mapElement} style={{ width: '100%', height: '100vh' }}></div>;
}

export default App;