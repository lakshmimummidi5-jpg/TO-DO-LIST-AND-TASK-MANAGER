package com.taskflow.api;

import java.time.Instant;

public class Task {
    public String id;
    public String title;
    public String description;
    public String dueDate;
    public String priority = "medium";
    public String category;
    public Boolean completed = false;
    public String createdAt = Instant.now().toString();

    public Task() {}
}
