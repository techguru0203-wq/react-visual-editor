import { message } from 'antd';

import {
  handleViewDatabase,
  TableInfo,
} from '../../containers/project/components/prototype/PrototypeDataBaseHandler';

export async function checkDatabaseEnv(
  doc: any,
  onDatabaseLoad: (tables: TableInfo[]) => void,
  t: (key: string) => string
): Promise<boolean> {
  const envSettings = doc?.meta?.envSettings;
  const dbUrl = envSettings?.DATABASE_URL;
  const jwt = envSettings?.JWT_SECRET;

  if (!dbUrl || (dbUrl.includes('supabase') && !jwt)) {
    message.warning(t('app.databaseUrlRequired'));
    const res = await handleViewDatabase(doc.id);
    onDatabaseLoad(res.tables);
    return false;
  }

  return true;
}
