import { Project, Section, Media } from '@prisma/client';

type SectionWithMedia = Section & { media: Media[] };
type ProjectWithSections = Project & { sections: SectionWithMedia[] };

export function serializeMedia(media: Media) {
  return {
    id: media.id,
    section_id: media.sectionId,
    media_type: media.mediaType,
    media_url: media.mediaUrl,
    is_clickable: media.isClickable,
    target_media_url: media.isClickable ? media.targetMediaUrl : null,
    sort_order: media.sortOrder,
    created_at: media.createdAt,
    updated_at: media.updatedAt,
  };
}

function sortSectionMedia(media: Media[]) {
  return media.slice().sort((a, b) => a.sortOrder - b.sortOrder);
}

export function serializeSection(section: SectionWithMedia) {
  return {
    id: section.id,
    project_id: section.projectId,
    title: section.title,
    sort_order: section.sortOrder,
    created_at: section.createdAt,
    updated_at: section.updatedAt,
    media: sortSectionMedia(section.media).map(serializeMedia),
  };
}

export function serializeProjectListItem(project: Project) {
  return {
    id: project.id,
    title: project.title,
    header_image_url: project.headerImageUrl,
  };
}

export function serializeProjectDetail(project: ProjectWithSections) {
  return {
    id: project.id,
    title: project.title,
    description: project.description,
    header_image_url: project.headerImageUrl,
    created_at: project.createdAt,
    updated_at: project.updatedAt,
    sections: project.sections
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(serializeSection),
  };
}

export function serializeProjectAdmin(project: Project) {
  return {
    id: project.id,
    title: project.title,
    description: project.description,
    header_image_url: project.headerImageUrl,
    created_at: project.createdAt,
    updated_at: project.updatedAt,
  };
}
