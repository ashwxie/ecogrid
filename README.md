# 🌿 EcoGrid Germany: Geospatial Energy Dashboard

A full-stack TypeScript application visualizing the spatial distribution of 20,000+ wind turbines across Germany. This project demonstrates high-performance handling of large-scale vector data using a professional GIS stack.

## 🚀 Key Features

* **Dynamic BBox Loading:** Instead of a monolithic 20MB data fetch, the app performs server-side spatial filtering. It only fetches turbines within the current map viewport (Bounding Box), significantly reducing network payload.
* **Spatial Proximity Search:** Right-click anywhere on the map to perform a "Nearest Neighbor" search using PostGIS `<->` operators to find the 3 closest turbines.
* **Intelligent Clustering:** Uses OpenLayers cluster source to merge data points at low zoom levels, maintaining 60fps performance even with 20k+ records.
* **Energy Impact Calculation:** Translates technical MW capacity into "Households Powered" statistics using real-world German energy consumption averages.

## 🛠 Tech Stack

### Frontend
- **React 18 & TypeScript**
- **OpenLayers**: Advanced map engine for coordinate transformations (EPSG:3857 ↔ 4326).
- **CSS3**: Responsive sidebar with real-time grid statistics.

### Backend
- **Node.js & Express**
- **PostgreSQL + PostGIS**: Used for spatial indexing (GIST) and geometric queries.
- **TypeScript**: Shared interfaces between frontend and backend for type safety.

## 📐 System Architecture

The application handles the "Web Mercator" vs "WGS84" challenge:
1.  **Map Layer**: Operates in `EPSG:3857` for visual accuracy.
2.  **API Layer**: Receives coordinates, transforms them to `EPSG:4326` for the database.
3.  **Database**: Uses **Spatial Indexing (GIST)** to perform `ST_MakeEnvelope` queries in milliseconds.



## 🛠 Installation & Setup

1. **Database:** Ensure PostGIS is installed.
   ```sql
   CREATE EXTENSION postgis;
   -- Import turbine data (CSV/SQL)