<template>
  <el-dialog
    :model-value="visible"
    @update:model-value="$emit('update:visible', $event)"
    title="上传资源"
    width="520px"
    :close-on-click-modal="false"
    @close="resetForm"
  >
    <el-form ref="formRef" :model="form" :rules="rules" label-width="80px">
      <el-form-item label="资源标题" prop="title">
        <el-input v-model="form.title" placeholder="建议格式：[真题/复习] 课程名 年份" maxlength="100" />
      </el-form-item>

      <el-form-item label="所属课程" prop="course_id">
        <el-select v-model="form.course_id" placeholder="请选择课程" filterable style="width:100%">
          <el-option
            v-for="course in courses"
            :key="course.id"
            :label="course.name"
            :value="course.id"
          />
        </el-select>
      </el-form-item>

      <el-form-item label="资料类型" prop="category_id">
        <el-select v-model="form.category_id" placeholder="请选择资料类型" style="width:100%">
          <el-option
            v-for="cat in categories"
            :key="cat.id"
            :label="cat.name"
            :value="cat.id"
          />
        </el-select>
      </el-form-item>

      <el-form-item label="描述" prop="description">
        <el-input
          v-model="form.description"
          type="textarea"
          :rows="3"
          placeholder="选填：年份、学期、题型说明等"
          maxlength="500"
          show-word-limit
        />
      </el-form-item>

      <el-form-item label="文件" prop="file">
        <el-upload
          ref="uploadRef"
          :auto-upload="false"
          :limit="1"
          :accept="acceptTypes"
          :on-change="handleFileChange"
          :on-exceed="() => ElMessage.warning('只能上传一个文件')"
          drag
        >
          <el-icon :size="40" class="upload-icon"><UploadFilled /></el-icon>
          <div class="upload-text">
            <p>将文件拖到此处，或<em>点击选择文件</em></p>
            <p style="font-size:12px;color:#909399;margin-top:4px">
              支持 PDF、Word、PPT、Excel 格式，最大 50MB
            </p>
          </div>
        </el-upload>
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="$emit('update:visible', false)">取消</el-button>
      <el-button type="primary" :loading="uploading" @click="handleUpload">
        {{ uploading ? '上传中...' : '提交审核' }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { getCategories } from '@/api/categoryApi'
import { getAllCourses } from '@/api/courseApi'
import { uploadResource } from '@/api/resourceApi'

const props = defineProps({ visible: Boolean })
const emit = defineEmits(['update:visible', 'success'])

const formRef = ref(null)
const uploadRef = ref(null)
const categories = ref([])
const courses = ref([])
const uploading = ref(false)
const selectedFile = ref(null)

const acceptTypes = '.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx'

const form = reactive({
  title: '',
  course_id: '',
  category_id: '',
  description: '',
})

const rules = {
  title: [{ required: true, message: '请输入资源标题', trigger: 'blur' }],
  category_id: [{ required: true, message: '请选择资料类型', trigger: 'change' }],
}

function handleFileChange(file) {
  selectedFile.value = file.raw
}

async function handleUpload() {
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return
  if (!selectedFile.value) {
    ElMessage.warning('请选择要上传的文件')
    return
  }

  uploading.value = true
  try {
    const fd = new FormData()
    fd.append('file', selectedFile.value)
    fd.append('title', form.title)
    fd.append('course_id', form.course_id)
    fd.append('category_id', form.category_id)
    fd.append('description', form.description)

    await uploadResource(fd)
    ElMessage.success('上传成功，等待管理员审核')
    emit('update:visible', false)
    emit('success')
  } catch (err) {
    // Error handled by interceptor
  } finally {
    uploading.value = false
  }
}

function resetForm() {
  form.title = ''
  form.course_id = ''
  form.category_id = ''
  form.description = ''
  formRef.value?.resetFields()
  selectedFile.value = null
  uploadRef.value?.clearFiles()
}

onMounted(async () => {
  try {
    const [catRes, courseRes] = await Promise.all([
      getCategories(),
      getAllCourses(),
    ])
    categories.value = catRes.data
    courses.value = courseRes.data
  } catch {}
})
</script>

<style scoped>
.upload-icon {
  margin-bottom: 8px;
}
.upload-text p {
  margin: 0;
  color: #606266;
}
</style>
