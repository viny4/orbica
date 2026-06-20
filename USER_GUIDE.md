# Orbica User Manual

Welcome to the Orbica User Manual. Orbica is an interactive web-based space tracking platform and aerospace database designed for tracking active satellites and researching historical spaceflight data.

This manual is organized into 10 structured sections to guide you through the platform's core functionalities.

---

## Section 1: System Overview

Orbica provides tools to monitor the near-Earth orbital environment in real-time and query a vast database of spaceflight history. The platform aggregates complex datasets—such as Two-Line Element (TLE) orbital data and historical launch telemetry—and presents them through an interactive web interface.

Primary capabilities include:
- Real-time 3D tracking of active satellites and debris.
- A comprehensive database of launch vehicles, payloads, and aerospace organizations.
- Predictive monitoring of orbital conjunctions (near-miss collision events).
- A chronologically ordered historical timeline of global spaceflight activity.

---

## Section 2: Command Center and Navigation
**Path:** `/` (Home Page)

The homepage serves as your primary command center. Navigation is designed to be highly accessible from any point within the application.

Global Search Function:
- The search bar is located at the top center of the interface.
- You can press `Cmd + K` (Mac) or `Ctrl + K` (Windows) at any time to open the global search modal.
- The search function indexes rockets, satellites, agencies, and historical missions simultaneously.

Sidebar Navigation:
- Use the left-hand sidebar menu to navigate between the primary databases. Click on "Tracker", "Timeline", "Rockets", "Satellites", "Agencies", or "Intel" to access their respective pages.

---

## Section 3: The Global 3D Tracker
**Path:** `/track`

The Global Tracker is the primary visualization engine of the platform. To access it, click the "Tracker" link in the left-hand navigation menu.

Interacting with the Globe:
- The main view features a highly detailed 3D model of the Earth surrounded by thousands of active objects currently in orbit.
- Click and drag your mouse anywhere on the screen to rotate the Earth.
- Scroll with your mouse wheel or trackpad to zoom in towards the surface or zoom out to view higher orbits.

Selecting Objects:
- Click on any point in orbit to select that specific satellite.
- The camera will lock onto the target, and a side panel will appear on the right side of the screen displaying real-time telemetry, including the object's name, owner, altitude, and current velocity.

---

## Section 4: Location-Based Sky View
**Path:** `/track`

The Sky View feature allows you to filter the massive orbital database down to only the objects currently passing overhead relative to your physical location.

How to enable Sky View:
1. Navigate to the Tracker interface (`/track`).
2. Locate and select the "Find Me" or "Share Location" button on the tracker dashboard.
3. Your web browser will prompt you to allow location access. Click "Allow" to proceed.
4. Orbica will process your coordinates and re-orient the 3D globe to look directly up from your exact city.
5. The visualization will update to display only the satellites currently visible in your local sky.

---

## Section 5: The Spaceflight Timeline
**Path:** `/timeline`

The Timeline provides a complete historical log of orbital spaceflight attempts. To access it, click "Timeline" in the left-hand sidebar menu.

Using the Timeline:
- The interface acts as a vertical feed. The default view shows the current year's launches.
- Scroll downward on the page to move back in time through previous years and decades.
- Each mission entry details the launch vehicle utilized, the primary payload, the responsible launch provider, and the launch facility.
- A prominent status indicator on each card displays the final outcome of the mission (Success, Partial Failure, or Failure).

---

## Section 6: Rocket Database
**Path:** `/rockets`

The Rockets database serves as a technical encyclopedia for launch vehicles. To view the database, click on "Rockets" in the left-hand sidebar menu.

Reviewing Technical Specifications:
- Selecting a specific vehicle from the list (e.g., Falcon 9, Atlas V) will navigate you to its dedicated profile page (`/rockets/[name]`).
- You can review primary dimensions, including height, diameter, and launch mass.
- Performance metrics are listed, detailing payload capacity to Low Earth Orbit (LEO) and Geostationary Transfer Orbit (GTO).
- Scroll down the page to view a propulsion breakdown detailing the specific engine models utilized on each stage.

---

## Section 7: Satellite Database
**Path:** `/satellites`

The Satellites section catalogs the actual payloads placed into orbit. To access this database, click on "Satellites" in the left-hand sidebar menu.

Understanding Satellite Profiles:
- Click on any satellite in the list to view its dedicated profile (`/satellites/[id]`).
- The top of the profile provides the operational status of the spacecraft (e.g., Operational, Backup, Decayed).
- Technical orbital parameters are listed in the center columns, including Apoapsis, Periapsis, Inclination, and Orbital Period.
- For mega-constellations, spacecraft are linked by their network (e.g., OneWeb, Starlink), allowing you to click the constellation name to view all related payloads within the same system.

---

## Section 8: Agencies and Operators
**Path:** `/agencies`

The Agencies database profiles the organizations responsible for manufacturing vehicles and conducting launches. Navigate to this section by clicking "Agencies" in the sidebar menu.

Exploring Organizations:
- The database includes both government space programs (e.g., NASA, ESA) and commercial entities (e.g., SpaceX, Rocket Lab).
- Selecting an agency from the list opens its profile page (`/agencies/[name]`).
- The profile displays a comprehensive list of all launch vehicles they have manufactured or operated.
- Scroll down the page to view an aggregated historical log of every launch the organization has conducted.

---

## Section 9: Space Intelligence and Conjunctions
**Path:** `/intel/conjunctions`

The orbital environment is heavily congested. The Intel section monitors this traffic to identify potential collision risks. To view this, expand the "Intel" menu in the sidebar and click on "Conjunctions".

Monitoring Conjunctions:
- A conjunction occurs when two orbital objects are predicted to pass within a dangerous proximity to one another.
- The Conjunctions page provides a live tabular feed of these warnings.
- Data points in the table include the names of the two objects involved, the exact Time of Closest Approach (TCA), and the predicted Miss Distance measured in meters.

---

## Section 10: Spaceflight Failures
**Path:** `/failures`

The Failures database chronicles the anomalies and accidents that have occurred throughout the history of space exploration. To access it, click "Failures" in the sidebar menu.

Analyzing Incident Reports:
- This section provides a filtered view of all missions that resulted in a failure or partial failure.
- Click on any failure entry to read detailed post-incident descriptions that explain the root cause of the anomaly, ranging from software errors to structural failures.
- Reviewing these records provides insight into the iterative engineering processes used by agencies to improve vehicle reliability.
