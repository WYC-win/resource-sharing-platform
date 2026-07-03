<template>
  <div class="page-container">
    <!-- Page title + Upload button -->
    <div class="page-title">
      <span v-if="!currentCourse">课程目录</span>
      <span v-else>
        <a class="back-link" @click="goBack">课程目录</a>
        <el-icon style="vertical-align:middle"><ArrowRight /></el-icon>
        {{ currentCourse.name }}
      </span>
      <el-button type="primary" :icon="'Upload'" @click="showUpload = true">
        上传资源
      </el-button>
    </div>

    <!-- Search bar: filters courses or resources depending on context -->
    <div class="search-bar">
      <el-input
        v-if="!currentCourse"
        v-model="courseSearch"
        placeholder="搜索课程..."
        :prefix-icon="'Search'"
        clearable
      />
      <template v-else>
        <el-input
          v-model="resourceSearch"
          placeholder="搜索资源标题..."
          :prefix-icon="'Search'"
          clearable
          @clear="loadResources"
          @keyup.enter="loadResources"
        />
        <el-select v-model="categoryId" placeholder="资料类型" clearable @change="loadResources">
          <el-option v-for="cat in categories" :key="cat.id" :label="cat.name" :value="cat.id" />
        </el-select>
        <el-button :icon="'Search'" type="primary" @click="loadResources">搜索</el-button>
      </template>
    </div>

    <!-- Loading state -->
    <div v-if="loading" class="loading-state">
      <el-icon class="is-loading" :size="32"><Loading /></el-icon>
      <p>加载中...</p>
    </div>

    <!-- ===== COURSE FOLDER VIEW (default) ===== -->
    <template v-else-if="!currentCourse">
      <div v-if="filteredCourses.length === 0" class="empty-state">
        <el-icon :size="48"><FolderOpened /></el-icon>
        <p>{{ courseSearch ? '未找到匹配的课程' : '暂无课程，请管理员先添加课程' }}</p>
      </div>

      <!-- Course grid -->
      <div v-else class="course-grid">
        <el-row :gutter="20">
          <el-col
            v-for="course in filteredCourses"
            :key="course.id"
            :xs="12" :sm="8" :md="6" :lg="4"
            style="margin-bottom:20px"
          >
            <el-card
              class="course-card"
              shadow="hover"
              :body-style="{ padding: '20px' }"
              @click="enterCourse(course)"
            >
              <div class="course-folder">
                <el-icon :size="48" color="#409eff"><Folder /></el-icon>
                <div class="course-name">{{ course.name }}</div>
                <div class="course-count">{{ course.count }} 份资料</div>
              </div>
            </el-card>
          </el-col>
        </el-row>
      </div>
    </template>

    <!-- ===== RESOURCE LIST VIEW (course selected) ===== -->
    <template v-else>
      <div v-if="resources.length === 0" class="empty-state">
        <el-icon :size="48"><FolderOpened /></el-icon>
        <p>该课程暂无资源</p>
      </div>

      <div v-else class="resource-grid">
        <el-row :gutter="16">
          <el-col
            v-for="item in resources"
            :key="item.id"
            :xs="24" :sm="12" :md="8" :lg="6"
            style="margin-bottom:16px"
          >
            <el-card class="resource-card" shadow="hover" @click="$router.push(`/resources/${item.id}`)">
              <div style="display:flex;align-items:flex-start;gap:12px">
                <div :class="['file-type-icon', item.file_type]">
                  {{ item.file_type.toUpperCase() }}
                </div>
                <div style="flex:1;min-width:0">
                  <h4 class="resource-title">{{ item.title }}</h4>
                  <p v-if="item.category_name" class="resource-meta">
                    {{ item.category_name }} · {{ item.sizeLabel }}
                  </p>
                  <p class="resource-meta" style="margin-top:4px">
                    <el-icon :size="12"><Download /></el-icon> {{ item.download_count }}
                    <el-icon :size="12" style="margin-left:8px"><User /></el-icon> {{ item.uploader_name }}
                  </p>
                </div>
              </div>
            </el-card>
          </el-col>
        </el-row>
      </div>

      <!-- Pagination -->
      <div v-if="total > 0" style="text-align:center;margin-top:20px">
        <el-pagination
          v-model:current-page="page"
          :page-size="pageSize"
          :total="total"
          :page-sizes="[24, 48, 96]"
          layout="total, sizes, prev, pager, next, jumper"
          @current-change="loadResources"
          @size-change="pageSize = $event; loadResources()"
        />
      </div>
    </template>

    <!-- Upload Dialog -->
    <UploadDialog v-model:visible="showUpload" @success="handleUploadSuccess" />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getResources } from '@/api/resourceApi'
import { getCourses } from '@/api/courseApi'
import { getCategories } from '@/api/categoryApi'
import UploadDialog from '@/components/resource/UploadDialog.vue'

const route = useRoute()
const router = useRouter()

const courses = ref([])
const resources = ref([])
const categories = ref([])
const loading = ref(false)
const showUpload = ref(false)
const courseSearch = ref('')
const resourceSearch = ref('')
const categoryId = ref('')
const page = ref(1)
const pageSize = ref(24)
const total = ref(0)

// Determine current course from URL query parameter
const currentCourse = computed(() => {
  const courseId = route.query.course_id
  if (!courseId) return null
  return courses.value.find(c => c.id === parseInt(courseId)) || { id: parseInt(courseId), name: '课程' }
})

// Fuzzy match: check if all query characters appear in order in the text
function fuzzyMatch(text, query) {
  if (!query) return true
  let qi = 0
  for (let ti = 0; ti < text.length && qi < query.length; ti++) {
    if (text[ti] === query[qi]) qi++
  }
  return qi === query.length
}

// Filter courses by search text (fuzzy)
const filteredCourses = computed(() => {
  const q = courseSearch.value.trim()
  if (!q) return courses.value
  return courses.value.filter(c => fuzzyMatch(c.name, q))
})

function enterCourse(course) {
  router.push({ query: { course_id: course.id } })
}

function goBack() {
  router.push({ query: {} })
}

async function loadResources() {
  loading.value = true
  try {
    const res = await getResources({
      page: page.value,
      pageSize: pageSize.value,
      search: resourceSearch.value,
      category_id: categoryId.value,
      course_id: currentCourse.value?.id || '',
    })
    // Apply fuzzy match on top of backend LIKE search for better abbreviation support
    let items = res.data || []
    if (resourceSearch.value.trim()) {
      const q = resourceSearch.value.trim()
      items = items.filter(item => fuzzyMatch(item.title, q))
    }
    resources.value = items
    total.value = res.meta?.total || 0
  } catch {
    resources.value = []
  } finally {
    loading.value = false
  }
}

function handleUploadSuccess() {
  showUpload.value = false
  if (currentCourse.value) {
    loadResources()
  }
}

onMounted(async () => {
  try {
    const [courseRes, catRes] = await Promise.all([
      getCourses(),
      getCategories(),
    ])
    courses.value = courseRes.data
    categories.value = catRes.data
  } catch {}

  if (route.query.course_id) {
    await loadResources()
  }
})

// Watch for course_id changes in the URL
watch(() => route.query.course_id, (newVal) => {
  if (newVal) {
    // Reset search and pagination when entering a new course
    resourceSearch.value = ''
    categoryId.value = ''
    page.value = 1
    loadResources()
  }
})
</script>

<style scoped>
.back-link {
  color: #409eff;
  cursor: pointer;
  font-weight: normal;
}
.back-link:hover {
  text-decoration: underline;
}

.loading-state {
  text-align: center;
  padding: 60px;
}
.loading-state p {
  margin-top: 12px;
  color: #909399;
}

/* Course folder grid */
.course-grid {
  min-height: 200px;
}
.course-card {
  cursor: pointer;
  transition: transform 0.2s;
}
.course-card:hover {
  transform: translateY(-4px);
}
.course-folder {
  text-align: center;
}
.course-name {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin-top: 10px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.course-count {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}

/* Resource cards */
.resource-grid {
  min-height: 200px;
}
.resource-title {
  font-size: 14px;
  margin-bottom: 6px;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.resource-meta {
  font-size: 12px;
  color: #909399;
  margin: 0;
}

/* Mobile fixes */
@media (max-width: 768px) {
  .search-bar .el-button {
    width: 100%;
  }
  .back-link {
    display: inline-block;
    margin-bottom: 4px;
  }
  .page-title span {
    word-break: break-all;
  }
}
</style>
