PRAGMA foreign_keys = ON;

INSERT OR IGNORE INTO dashboard_features(
  id,slug,name,description,category,feature_type,tile_presentation,route,icon_text,audience,
  default_size,allowed_sizes,default_width,default_height,allowed_dimensions,
  is_active,is_default,sort_order,created_at,updated_at
) VALUES
('feature-live-clock','live-clock','Clock','A live local clock and current date.','Live','system','content','','CLK','all','medium','small,medium,large,wide',2,1,'1x1,2x1,2x2,3x1,3x2,4x1',1,0,300,unixepoch(),unixepoch()),
('feature-module-calendar','module-calendar','Calendar','A live month calendar with today’s events and appointments.','Personal modules','system','content','/hub#calendar','CAL','all','large','large,wide',4,3,'3x2,4x2,4x3,5x3,6x3,6x4',1,0,410,unixepoch(),unixepoch());

UPDATE dashboard_features
SET name='Clock',description='A live local clock and current date.',category='Live',feature_type='system',tile_presentation='content',route='',icon_text='CLK',audience='all',
    default_size='medium',allowed_sizes='small,medium,large,wide',default_width=2,default_height=1,allowed_dimensions='1x1,2x1,2x2,3x1,3x2,4x1',is_active=1,sort_order=300,updated_at=unixepoch()
WHERE id='feature-live-clock';

UPDATE dashboard_features
SET name='Calendar',description='A live month calendar with today’s events and appointments.',category='Personal modules',feature_type='system',tile_presentation='content',route='/hub#calendar',icon_text='CAL',audience='all',
    default_size='large',allowed_sizes='large,wide',default_width=4,default_height=3,allowed_dimensions='3x2,4x2,4x3,5x3,6x3,6x4',is_active=1,sort_order=410,updated_at=unixepoch()
WHERE id='feature-module-calendar';
