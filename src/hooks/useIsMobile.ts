import { Grid } from 'antd';

/** 视口宽度 < 768px 视为移动端 */
export function useIsMobile(): boolean {
  const screens = Grid.useBreakpoint();
  return !screens.md;
}
