import { describe, expect, it } from 'vitest';
import { parseSamsungSteps } from './samsungCsv';

describe('Samsung Health CSV import', () => {
  it('parses step_daily_trend (epoch-ms day_time, trailing comma)', () => {
    const csv = [
      'com.samsung.shealth.step_daily_trend,6156001,6',
      'binning_data,update_time,create_time,source_pkg_name,source_type,count,speed,distance,calorie,deviceuuid,pkg_name,datauuid,day_time',
      'a.json,2021-03-03 08:19:37.682,2021-03-03 08:19:37.682,com.sec.android.app.shealth,0,13546,1.25,10135.7,480.8,OD8X,com.sec.android.app.shealth,a,1604880000000,',
      'b.json,2021-03-03 08:19:37.682,2021-03-03 08:19:37.682,com.sec.android.app.shealth,0,6341,1.26,4747.3,224.6,OD8X,com.sec.android.app.shealth,b,1605052800000,',
    ].join('\n');
    expect(parseSamsungSteps(csv)).toEqual([
      { date: '2020-11-09', count: 13546 },
      { date: '2020-11-11', count: 6341 },
    ]);
  });

  it('prefers the combined total (source_type −2) and never double-counts phone + watch', () => {
    const csv = [
      'com.samsung.shealth.step_daily_trend,7006003,6',
      'source_type,count,day_time,source_name',
      '-2,4500,2026-05-04T00:00:00-03:00,Samsung Health',
      '0,3000,2026-05-04T00:00:00-03:00,Phone',
      '109,4000,2026-05-04T00:00:00-03:00,Galaxy Watch',
      '0,3000,2026-05-05T00:00:00-03:00,Phone',
      '109,3500,2026-05-05T00:00:00-03:00,Galaxy Watch',
    ].join('\n');
    expect(parseSamsungSteps(csv)).toEqual([
      { date: '2026-05-04', count: 4500 },
      { date: '2026-05-05', count: 3500 },
    ]);
  });

  it('parses pedometer_day_summary with namespaced headers', () => {
    const csv = ['com.samsung.shealth.tracker.pedometer_day_summary,1,1', 'com.samsung.health.step_count.step_count,day_time', '8123,1762732800000'].join('\n');
    expect(parseSamsungSteps(csv)).toEqual([{ date: '2025-11-10', count: 8123 }]);
  });

  it('rejects other files', () => {
    expect(() => parseSamsungSteps('a,b\n1,2')).toThrow(/Samsung/);
  });
});
