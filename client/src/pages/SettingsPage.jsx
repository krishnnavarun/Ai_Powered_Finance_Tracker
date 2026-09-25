import { m } from 'motion/react';
import { PageHeader } from '@/components/common/PageHeader';
import { CategoriesSection } from '@/features/settings/CategoriesSection';
import { DataSection } from '@/features/settings/DataSection';
import { PreferencesSection } from '@/features/settings/PreferencesSection';
import { ProfileSection } from '@/features/settings/ProfileSection';

const list = { show: { transition: { staggerChildren: 0.07 } } };
const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } },
};

export function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" description="Your account, privacy and categories" />
      <m.div variants={list} initial="hidden" animate="show" className="grid gap-4 lg:grid-cols-2">
        <m.div variants={item} className="lg:col-span-2">
          <ProfileSection />
        </m.div>
        <m.div variants={item}>
          <PreferencesSection />
        </m.div>
        <m.div variants={item}>
          <CategoriesSection />
        </m.div>
        <m.div variants={item} className="lg:col-span-2">
          <DataSection />
        </m.div>
      </m.div>
    </>
  );
}
