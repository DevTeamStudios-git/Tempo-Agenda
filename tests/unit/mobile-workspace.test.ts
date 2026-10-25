import {describe,it,expect} from 'vitest';
import {isTrustedWorkspaceUrl,workspaceNavigation,safeReturnPath} from '../../shared/mobile-policy';
describe('mobile workspace boundary',()=>{
 const origin='https://tempo.example';
 it('keeps session messages on the exact workspace origin',()=>{
  expect(isTrustedWorkspaceUrl(origin+'/mobile/connect',origin)).toBe(true);
  for(const url of ['https://tempo.example.evil.test/mobile','http://tempo.example/mobile','https://tempo.example:444/mobile','javascript:alert(1)','file:///mobile'])expect(isTrustedWorkspaceUrl(url,origin)).toBe(false);
 });
 it('opens external web links outside the workspace and blocks executable schemes',()=>{
  expect(workspaceNavigation(origin+'/mobile',origin)).toBe('internal');
  expect(workspaceNavigation('https://accounts.google.com',origin)).toBe('external');
  expect(workspaceNavigation('mailto:hello@example.com',origin)).toBe('external');
  for(const url of ['javascript:alert(1)','data:text/html,hello','file:///etc/passwd','intent://auth'])expect(workspaceNavigation(url,origin)).toBe('blocked');
 });
 it('preserves relative sign-in destinations and rejects open redirects',()=>{
  expect(safeReturnPath('/mobile?view=week')).toBe('/mobile?view=week');
  for(const path of ['//evil.test','/\\evil.test','https://evil.test','/\nevil.test',null])expect(safeReturnPath(path)).toBe('/');
 });
});
