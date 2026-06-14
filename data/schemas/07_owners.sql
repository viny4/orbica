-- ORBICA — decode SATCAT owner/source codes (CIS, PRC, ITSO, GLOB…) into
-- real operator/country names + a country flag code. Satellites carry these
-- cryptic codes; this makes the "Owner" meaningful and flaggable.

CREATE TABLE IF NOT EXISTS satcat_owners (
    code         VARCHAR(8) PRIMARY KEY,
    name         VARCHAR(120) NOT NULL,
    country_code CHAR(3)
);

INSERT INTO satcat_owners (code, name, country_code) VALUES
  ('AB','Arabsat','SAU'),('ABS','Asia Broadcast Satellite',NULL),('AC','AsiaSat',NULL),
  ('ALG','Algeria','DZA'),('ANG','Angola','AGO'),('ARGN','Argentina','ARG'),('ARM','Armenia','ARM'),
  ('ASRA','Austria','AUT'),('AUS','Australia','AUS'),('AZER','Azerbaijan','AZE'),('BEL','Belgium','BEL'),
  ('BELA','Belarus','BLR'),('BGD','Bangladesh','BGD'),('BHR','Bahrain','BHR'),('BHUT','Bhutan','BTN'),
  ('BOL','Bolivia','BOL'),('BRAZ','Brazil','BRA'),('BUL','Bulgaria','BGR'),('BWA','Botswana','BWA'),
  ('CA','Canada','CAN'),('CHBZ','China / Brazil','CHN'),('CHLE','Chile','CHL'),
  ('CIS','Russia (CIS / former USSR)','RUS'),('COL','Colombia','COL'),('CRI','Costa Rica','CRI'),
  ('CZCH','Czech Republic','CZE'),('DEN','Denmark','DNK'),('DJI','Djibouti','DJI'),('ECU','Ecuador','ECU'),
  ('EGYP','Egypt','EGY'),('ESA','European Space Agency',NULL),('ESRO','European Space Research Org.',NULL),
  ('EST','Estonia','EST'),('ETH','Ethiopia','ETH'),('EUME','EUMETSAT',NULL),('EUTE','Eutelsat','FRA'),
  ('FGER','France / Germany','FRA'),('FIN','Finland','FIN'),('FR','France','FRA'),('FRIT','France / Italy','FRA'),
  ('GER','Germany','DEU'),('GHA','Ghana','GHA'),('GLOB','Globalstar','USA'),('GREC','Greece','GRC'),
  ('GRSA','Greece / Saudi Arabia',NULL),('GUAT','Guatemala','GTM'),('HRV','Croatia','HRV'),('HUN','Hungary','HUN'),
  ('IM','Isle of Man',NULL),('IND','India','IND'),('INDO','Indonesia','IDN'),('IRAN','Iran','IRN'),
  ('IRAQ','Iraq','IRQ'),('IRL','Ireland','IRL'),('ISRA','Israel','ISR'),('ISS','International Space Station',NULL),
  ('IT','Italy','ITA'),('ITSO','Intelsat','USA'),('JOR','Jordan','JOR'),('JPN','Japan','JPN'),
  ('KAZ','Kazakhstan','KAZ'),('KEN','Kenya','KEN'),('KWT','Kuwait','KWT'),('LAOS','Laos','LAO'),
  ('LKA','Sri Lanka','LKA'),('LTU','Lithuania','LTU'),('LUXE','Luxembourg','LUX'),('MA','Morocco','MAR'),
  ('MALA','Malaysia','MYS'),('MCO','Monaco','MCO'),('MDA','Moldova','MDA'),('MEX','Mexico','MEX'),
  ('MMR','Myanmar','MMR'),('MNE','Montenegro','MNE'),('MNG','Mongolia','MNG'),('MUS','Mauritius','MUS'),
  ('NATO','NATO',NULL),('NETH','Netherlands','NLD'),('NICO','ICO Global','USA'),('NIG','Nigeria','NGA'),
  ('NKOR','North Korea','PRK'),('NOR','Norway','NOR'),('NPL','Nepal','NPL'),('NZ','New Zealand','NZL'),
  ('O3B','O3b Networks',NULL),('ORB','Orbcomm','USA'),('PAKI','Pakistan','PAK'),('PERU','Peru','PER'),
  ('POL','Poland','POL'),('POR','Portugal','PRT'),('PRC','China','CHN'),('PRY','Paraguay','PRY'),
  ('RASC','RascomStar-QAF',NULL),('ROC','Taiwan','TWN'),('ROM','Romania','ROU'),('RP','Philippines','PHL'),
  ('RWA','Rwanda','RWA'),('SAFR','South Africa','ZAF'),('SAUD','Saudi Arabia','SAU'),('SDN','Sudan','SDN'),
  ('SEAL','Sea Launch',NULL),('SEN','Senegal','SEN'),('SES','SES','LUX'),('SGJP','Singapore / Japan',NULL),
  ('SING','Singapore','SGP'),('SKOR','South Korea','KOR'),('SLB','Solomon Islands','SLB'),
  ('SPN','Spain','ESP'),('STCT','Singapore / Taiwan',NULL),('SVK','Slovakia','SVK'),('SVN','Slovenia','SVN'),
  ('SWED','Sweden','SWE'),('SWTZ','Switzerland','CHE'),('TBD','To Be Determined',NULL),('THAI','Thailand','THA'),
  ('TMMC','Turkmenistan / Monaco',NULL),('TUN','Tunisia','TUN'),('TURK','Turkey','TUR'),
  ('UAE','United Arab Emirates','ARE'),('UGA','Uganda','UGA'),('UK','United Kingdom','GBR'),('UKR','Ukraine','UKR'),
  ('URY','Uruguay','URY'),('US','United States','USA'),('USBZ','United States / Brazil','USA'),
  ('VAT','Vatican City','VAT'),('VENZ','Venezuela','VEN'),('VTNM','Vietnam','VNM'),('ZWE','Zimbabwe','ZWE')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, country_code = EXCLUDED.country_code;
