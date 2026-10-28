class ApiResponse {
  static success(res, data = null, message = 'Success', statusCode = 200) {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
    });
  }

  static created(res, data, message = 'Resource created successfully') {
    return ApiResponse.success(res, data, message, 201);
  }

  static paginated(res, items, pagination, message = 'Records retrieved successfully') {
    return res.status(200).json({
      success: true,
      message,
      data: items,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total_records: pagination.totalRecords,
        total_pages: pagination.totalPages,
        has_next_page: pagination.page < pagination.totalPages,
        has_prev_page: pagination.page > 1,
      },
    });
  }
}

module.exports = ApiResponse;
