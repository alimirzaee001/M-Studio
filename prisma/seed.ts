import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.media.deleteMany();
  await prisma.section.deleteMany();
  await prisma.project.deleteMany();

  const project = await prisma.project.create({
    data: {
      title: 'اقامتگاه مدرن کنار رودخانه',
      description:
        'خانه‌ای معاصر تک‌خانواده که برای هم‌زیستی با بستر طبیعی کنار رودخانه طراحی شده است؛ با فضاهای باز معیشتی و مصالح پایدار.',
      headerImageUrl: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200&q=80',
      sections: {
        create: [
          {
            title: 'اسکیس‌های اولیه',
            sortOrder: 0,
            media: {
              create: [
                {
                  mediaType: 'image',
                  mediaUrl: 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=800&q=80',
                  isClickable: true,
                  targetMediaUrl: 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=2400&q=90',
                  sortOrder: 0,
                },
                {
                  mediaType: 'image',
                  mediaUrl: 'https://images.unsplash.com/photo-1487958449943-2429c8be7635?w=800&q=80',
                  isClickable: false,
                  targetMediaUrl: null,
                  sortOrder: 1,
                },
                {
                  mediaType: 'image',
                  mediaUrl: 'https://images.unsplash.com/photo-1511818966892-d7d671e443ea?w=800&q=80',
                  isClickable: true,
                  targetMediaUrl: 'https://images.unsplash.com/photo-1511818966892-d7d671e443ea?w=2400&q=90',
                  sortOrder: 2,
                },
              ],
            },
          },
          {
            title: 'نقشه‌های فنی',
            sortOrder: 1,
            media: {
              create: [
                {
                  mediaType: 'image',
                  mediaUrl: 'https://images.unsplash.com/photo-1503384157-6a8496e126be?w=800&q=80',
                  isClickable: true,
                  targetMediaUrl: 'https://images.unsplash.com/photo-1503384157-6a8496e126be?w=2400&q=90',
                  sortOrder: 0,
                },
                {
                  mediaType: 'image',
                  mediaUrl: 'https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=800&q=80',
                  isClickable: false,
                  targetMediaUrl: null,
                  sortOrder: 1,
                },
                {
                  mediaType: 'video_link',
                  mediaUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                  isClickable: false,
                  targetMediaUrl: null,
                  sortOrder: 2,
                },
              ],
            },
          },
          {
            title: 'رندرهای نهایی',
            sortOrder: 2,
            media: {
              create: [
                {
                  mediaType: 'image',
                  mediaUrl: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80',
                  isClickable: true,
                  targetMediaUrl: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=2400&q=90',
                  sortOrder: 0,
                },
                {
                  mediaType: 'image',
                  mediaUrl: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&q=80',
                  isClickable: true,
                  targetMediaUrl: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=2400&q=90',
                  sortOrder: 1,
                },
                {
                  mediaType: 'image',
                  mediaUrl: 'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800&q=80',
                  isClickable: false,
                  targetMediaUrl: null,
                  sortOrder: 2,
                },
                {
                  mediaType: 'image',
                  mediaUrl: 'https://images.unsplash.com/photo-1600573472550-8090b5e0745e?w=800&q=80',
                  isClickable: false,
                  targetMediaUrl: null,
                  sortOrder: 3,
                },
              ],
            },
          },
        ],
      },
    },
    include: {
      sections: {
        include: { media: true },
      },
    },
  });

  console.log('Seed completed successfully.');
  console.log(`Created project: "${project.title}" (${project.id})`);
  console.log(`  Sections: ${project.sections.length}`);
  console.log(
    `  Media items: ${project.sections.reduce((sum, s) => sum + s.media.length, 0)}`,
  );
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
